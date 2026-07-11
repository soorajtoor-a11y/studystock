import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env before anything reads process.env
const __envPath = fileURLToPath(new URL('.env', import.meta.url));
if (fs.existsSync(__envPath)) {
  for (const line of fs.readFileSync(__envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const MATERIALS_DIR   = path.join(__dirname, '..', 'study-materials');
const BOT_RULES_PATH  = path.join(__dirname, '..', 'bot-rules.txt');
const GEN_RULES_PATH  = path.join(__dirname, '..', 'question-generation-rules.txt');

// Read generation rules once at startup so every prompt gets them
let GEN_RULES = '';
try { GEN_RULES = fs.readFileSync(GEN_RULES_PATH, 'utf8'); }
catch { console.warn('question-generation-rules.txt not found — generation will run without rules'); }

const PROVIDER      = process.env.AI_PROVIDER  || 'ollama';
const OLLAMA_MODEL  = process.env.OLLAMA_MODEL  || 'llama3.2';
const OLLAMA_URL    = 'http://localhost:11434/api/chat';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL  = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_BASE   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`;

const OLLAMA_FAST_OPTS = { temperature: 0.7, num_ctx: 4096,  num_predict: 2048 };
const OLLAMA_GEN_OPTS  = { temperature: 0.3, num_ctx: 16384, num_predict: -1   };

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function extractRelevantSection(outlineText, objectiveText) {
  const lines = outlineText.split('\n');
  const sections = [];
  let current = [];
  for (const line of lines) {
    if (/^[A-Z]\.\s+/.test(line.trim()) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) sections.push(current.join('\n'));
  const lower = objectiveText.toLowerCase();
  const match = sections.find(s => {
    const words = lower.split(' ').filter(w => w.length > 4);
    return words.some(w => s.toLowerCase().includes(w));
  });
  return match || sections[0] || outlineText;
}

// Retry a fallible async fn up to maxAttempts times total.
async function withRetry(fn, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        console.warn(`Attempt ${attempt}/${maxAttempts} failed: ${err.message} — retrying…`);
      }
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// extractJSON — survives every known llama3.2 output failure mode:
//  1. Missing closing ]        → last-resort: append ] after last }
//  2. Text before the array    → skip to first [
//  3. Text after the array     → backward-scan finds real closing ]
//  4. Truncated mid-object     → last-resort trims to last complete }
//  5. Trailing comma           → repair()
//  6. Missing comma between }{ → repair()
//  7. Markdown fences          → stripped up front
// ---------------------------------------------------------------------------
function extractJSON(raw) {
  let text = raw
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/```\s*$/m, '')
    .trim();

  function repair(t) {
    return t
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([}\]])([ \t]*\n[ \t]*)([{\[])/g, '$1,$2$3');
  }

  try { const r = JSON.parse(repair(text)); if (Array.isArray(r)) return r; } catch (_) {}

  const arrayStart = text.indexOf('[');
  if (arrayStart === -1) throw new Error('No JSON array found in model response');
  const sub = text.slice(arrayStart);

  for (let i = sub.length - 1; i >= 0; i--) {
    if (sub[i] !== ']') continue;
    try { const r = JSON.parse(repair(sub.slice(0, i + 1))); if (Array.isArray(r)) return r; } catch (_) {}
  }

  const lastBrace = sub.lastIndexOf('}');
  if (lastBrace > 0) {
    try { const r = JSON.parse(repair(sub.slice(0, lastBrace + 1) + ']')); if (Array.isArray(r)) return r; } catch (_) {}
  }

  throw new Error('Model returned malformed JSON — please try again');
}

// ---------------------------------------------------------------------------
// Pre-generated question bank helpers
// ---------------------------------------------------------------------------

function loadBank(event) {
  const bankPath = path.join(MATERIALS_DIR, event, 'question-bank.json');
  if (!fs.existsSync(bankPath)) return null;
  try { return JSON.parse(fs.readFileSync(bankPath, 'utf8')); }
  catch { return null; }
}

function bankToQuizFormat(q) {
  const letters = ['A', 'B', 'C', 'D'];
  return {
    question:       q.question,
    options:        { A: q.options[0], B: q.options[1], C: q.options[2], D: q.options[3] },
    answer:         letters[q.correct_index],
    explanation:    q.explanation,
    knowledge_area: q.knowledge_area,
    difficulty:     q.difficulty,
  };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Try to serve `count` questions from the bank matching `difficulty`.
// For section-scoped requests, filter by knowledge_area.
// Returns an array of quiz-format questions, or null if bank can't satisfy.
function serveFromBank(event, objective, count, difficulty) {
  const bank = loadBank(event);
  if (!bank) return null;

  let pool = difficulty ? bank.filter(q => q.difficulty === difficulty) : bank;

  // If this is a section-scoped request (not a full-event review), try to
  // narrow to matching knowledge areas by checking for overlap in words.
  const isFullEvent = objective.toLowerCase().includes('complete review');
  if (!isFullEvent) {
    const objWords = new Set(
      objective.toLowerCase().split(/\W+/).filter(w => w.length > 4)
    );
    const sectionPool = pool.filter(q => {
      const areaWords = (q.knowledge_area || '').toLowerCase().split(/\W+/);
      return areaWords.some(w => w.length > 4 && objWords.has(w));
    });
    if (sectionPool.length >= count) pool = sectionPool;
  }

  if (pool.length < count) return null;
  return shuffle(pool).slice(0, count).map(bankToQuizFormat);
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

app.get('/api/events', (req, res) => {
  const events = fs.readdirSync(MATERIALS_DIR)
    .filter(f => fs.statSync(path.join(MATERIALS_DIR, f)).isDirectory());
  res.json(events.sort());
});

app.get('/api/events/:event/outline', (req, res) => {
  const outlinePath = path.join(MATERIALS_DIR, req.params.event, 'event-outline.txt');
  const contentPath = path.join(MATERIALS_DIR, req.params.event, 'study-content.txt');
  if (!fs.existsSync(outlinePath)) return res.status(404).json({ error: 'Not found' });
  let content = fs.readFileSync(outlinePath, 'utf8');
  if (fs.existsSync(contentPath)) {
    // Extract just the structured objectives block (the section between the
    // first and second === separators in study-content.txt).  That block
    // has the A. Title / 1. objective format the frontend parser needs.
    const parts = fs.readFileSync(contentPath, 'utf8').split(/={20,}/);
    if (parts.length >= 3) content = parts[1].trim() + '\n\n' + content;
  }
  res.json({ content });
});

function getOutline(event) {
  const p  = path.join(MATERIALS_DIR, event, 'event-outline.txt');
  const p2 = path.join(MATERIALS_DIR, event, 'event-outline 2.txt');
  let content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (fs.existsSync(p2)) content += '\n\n' + fs.readFileSync(p2, 'utf8');
  return content;
}

function getExtras(event) {
  return ['notes.txt', 'vocab.txt', 'mistakes.txt', 'study-content.txt']
    .map(f => path.join(MATERIALS_DIR, event, f))
    .filter(fs.existsSync)
    .map(f => `--- ${path.basename(f)} ---\n${fs.readFileSync(f, 'utf8')}`)
    .join('\n\n');
}

function buildSystemPrompt(event, objectiveText, mode) {
  const botRules = fs.readFileSync(BOT_RULES_PATH, 'utf8');
  const outline  = getOutline(event);
  const section  = extractRelevantSection(outline, objectiveText);
  const extras   = getExtras(event);
  return `${botRules}

--- RELEVANT OUTLINE SECTION ---
${section}
${extras ? `\n--- STUDENT FILES ---\n${extras}` : ''}

Objective: "${objectiveText}"
Mode: ${mode.toUpperCase()}. Stay focused on this objective.`;
}

// ---------------------------------------------------------------------------
// Ollama callers
// ---------------------------------------------------------------------------

async function callOllama(messages, opts = {}) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, stream: false, options: opts, messages }),
  });
  const data = await response.json();
  return data.message?.content || '';
}

// Streaming accumulation with line buffering — a JSON object that spans two
// read() chunks is never silently dropped.
async function callOllamaStreaming(messages, opts = {}) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OLLAMA_MODEL, stream: true, options: opts, messages }),
  });
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let buf  = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();           // keep incomplete trailing fragment
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        text += json.message?.content || '';
        if (json.done) return text;
      } catch {}
    }
  }
  if (buf.trim()) {
    try { const json = JSON.parse(buf); text += json.message?.content || ''; } catch {}
  }
  return text;
}

async function streamOllama(systemPrompt, messages, res) {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: true,
      options: OLLAMA_FAST_OPTS,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        const t = json.message?.content || '';
        if (t) res.write(`data: ${JSON.stringify({ text: t })}\n\n`);
        if (json.done) return;
      } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Gemini callers
// ---------------------------------------------------------------------------

// Non-streaming generation — used for quiz/flashcard JSON output.
// responseMimeType:'application/json' forces the model to emit valid JSON.
async function callGemini(prompt, genOpts = {}) {
  const url = `${GEMINI_BASE}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 16384, responseMimeType: 'application/json', ...genOpts },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Streaming SSE — used for the chat/explain endpoint.
async function streamGemini(systemPrompt, messages, res) {
  const url = `${GEMINI_BASE}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err.slice(0, 200)}`);
  }
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const json = JSON.parse(raw);
        const t = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (t) res.write(`data: ${JSON.stringify({ text: t })}\n\n`);
      } catch {}
    }
  }
}

// ---------------------------------------------------------------------------
// Anthropic callers
// ---------------------------------------------------------------------------

async function callAnthropic(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });
  return msg.content[0].text;
}

async function streamAnthropic(systemPrompt, messages, res) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemPrompt, messages,
  });
  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
    }
  }
}

// ---------------------------------------------------------------------------
// Flashcard normalization
// ---------------------------------------------------------------------------

function normalizeCards(cards) {
  return cards
    .map(c => {
      if (typeof c === 'string') {
        const sep = c.indexOf(':');
        if (sep > 0 && sep < 60) return { front: c.slice(0, sep).trim(), back: c.slice(sep + 1).trim() };
        return { front: '', back: c.trim() };
      }
      return {
        front: String(c.front ?? c.term ?? c.question ?? c.Front ?? c.Term ?? c.Question ?? ''),
        back:  String(c.back  ?? c.definition ?? c.answer ?? c.Back ?? c.Definition ?? c.Answer ?? ''),
      };
    })
    .filter(c => c.front.trim() || c.back.trim());
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildGenPrompt(type, count, objective, outline, difficulty, extras = '') {
  const diffGuide = {
    easy:   'Simple recall and basic understanding only.',
    medium: 'Mix of recall and application.',
    hard:   'In-depth analysis and nuanced understanding.',
  }[difficulty] || 'Mix of recall and application.';

  const studyBlock = [
    outline ? `--- EVENT OUTLINE ---\n${outline.slice(0, 1500).trim()}` : '',
    extras  ? `--- STUDY CONTENT ---\n${extras.slice(0, 3000).trim()}`  : '',
  ].filter(Boolean).join('\n\n');

  if (type === 'quiz') {
    return `${GEN_RULES}

--- TASK ---
Output ONLY a valid JSON array. No text before or after the array.

Generate exactly ${count} multiple-choice questions about: "${objective}"
Difficulty: ${difficulty} — ${diffGuide}
${studyBlock ? `\n${studyBlock}\n` : ''}
Format — every object must have these exact keys:
[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"2-3 sentences: why correct and why the wrong choices are wrong","knowledge_area":"topic area","difficulty":"${difficulty}"}]

Rules:
- "answer" must be exactly A, B, C, or D
- No text outside the array
- The array MUST end with ]`;
  }

  return `Output ONLY a valid JSON array. No text before or after the array.

Generate EXACTLY ${count} flashcards about: "${objective}"
${studyBlock ? `\n${studyBlock}\n` : ''}
Format:
[{"front":"short term or concept","back":"1-2 sentence definition"}]

Rules:
- Every object must have "front" and "back" string keys
- front: concise term (under 10 words)
- back: clear explanation (1-2 sentences)
- EXACTLY ${count} cards — no more, no fewer
- No duplicate topics
- Array MUST end with ]`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Quiz generation — serves from pre-generated bank when available, falls back to AI
app.post('/api/quiz', async (req, res) => {
  const { event, objective, count, difficulty } = req.body;

  // Fast path: serve from pre-generated bank (instant, no AI cost)
  const banked = serveFromBank(event, objective, count, difficulty);
  if (banked) {
    console.log(`[bank] serving ${banked.length} ${difficulty} questions for ${event}`);
    return res.json({ questions: banked, source: 'bank' });
  }

  // Slow path: generate with AI
  const outline = extractRelevantSection(getOutline(event), objective);
  const extras  = getExtras(event);
  const prompt  = buildGenPrompt('quiz', count, objective, outline, difficulty, extras);

  try {
    const questions = await withRetry(async () => {
      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(count * 350, 16384) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      return extractJSON(raw);
    });
    res.json({ questions: questions.slice(0, count), source: 'ai' });
  } catch (err) {
    console.error('Quiz error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Flashcard generation — retries up to 3 times total, slices to exact count
app.post('/api/flashcards', async (req, res) => {
  const { event, objective, count } = req.body;
  const outline = extractRelevantSection(getOutline(event), objective);
  const extras  = getExtras(event);
  const prompt  = buildGenPrompt('flashcard', count, objective, outline, '', extras);

  try {
    const parsed = await withRetry(async () => {
      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(count * 200, 8192) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      return extractJSON(raw);
    });
    const cards = normalizeCards(parsed).slice(0, count);
    if (cards.length === 0) throw new Error('Model returned no usable flashcards');
    res.json({ cards });
  } catch (err) {
    console.error('Flashcard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Chat / Explain — SSE streaming
app.post('/api/chat', async (req, res) => {
  const { messages, event, objective, mode } = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.socket?.setNoDelay?.(true);

  try {
    const systemPrompt = buildSystemPrompt(event, objective, mode);
    if (PROVIDER === 'anthropic') await streamAnthropic(systemPrompt, messages, res);
    else if (PROVIDER === 'gemini') await streamGemini(systemPrompt, messages, res);
    else await streamOllama(systemPrompt, messages, res);
  } catch (err) {
    console.error(err);
    res.write(`data: ${JSON.stringify({ text: '\n\n[Error: ' + err.message + ']' })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});

// In production, serve the Vite-built frontend and handle client-side routing
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`StudyStock — provider: ${PROVIDER} — port: ${PORT}`));
