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

// Mechanical safety net for RULE 2 (option length balance) on the live
// on-the-fly path. Bulk generation (generate_bank.py) has real code-level
// enforcement for answer-position balance — shuffle_answer_positions()
// reassigns positions after generation, it doesn't just hope the model
// followed the prompt. The live path here had NO equivalent: it served
// whatever the model returned with zero validation, relying entirely on
// prompt compliance every single call. That's why length-bias kept slipping
// through here specifically even after the prompt was strengthened twice.
// This doesn't achieve full RULE 2 compliance (that needs judgment), but it
// mechanically catches the egregious, observed failure mode: the correct
// answer being obviously the longest, most-hedged option. A batch that
// fails this check is rejected and retried with a fresh API call — same
// retry mechanism as a malformed-JSON response.
function hasObviousLengthTell(q) {
  const letters = ['A', 'B', 'C', 'D'];
  const wordCount = s => (s || '').trim().split(/\s+/).filter(Boolean).length;
  const correctCount = wordCount(q.options?.[q.answer]);
  if (!correctCount) return false;
  const otherCounts = letters.filter(l => l !== q.answer).map(l => wordCount(q.options?.[l]));
  const avgOther = otherCounts.reduce((a, b) => a + b, 0) / otherCounts.length;
  // Combined relative + absolute check: catches genuinely hedged/detailed
  // correct answers (the real observed failure) without over-triggering on
  // short-option questions where a 1-word natural difference is meaningless.
  return (correctCount - avgOther) >= 3 && correctCount > avgOther * 1.2;
}

function findLengthTellViolations(questions) {
  return (questions || []).filter(hasObviousLengthTell);
}

// ---------------------------------------------------------------------------
// Duplicate-question prevention for the live on-the-fly path. The bulk
// generator (generate_bank.py) already does this via already_asked_block() —
// this mirrors it exactly, but the live path never had ANY version of it,
// within a single batch or across separate quiz requests for the same
// objective. That's a real gap: nothing stopped the same fact from being
// asked twice in one 15-question response, or a user re-generating a quiz
// on the same objective and getting near-identical questions every time.
// ---------------------------------------------------------------------------

function normalizeQuestionText(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

// Catches exact/near-exact repeats WITHIN one generated batch (normalized
// string match — won't catch a fact reworded in genuinely different words,
// but that's what the already-asked memory below is for across requests).
function findDuplicateViolations(questions) {
  const seen = new Set();
  const violations = [];
  for (const q of (questions || [])) {
    const norm = normalizeQuestionText(q.question);
    if (seen.has(norm)) violations.push(q);
    else seen.add(norm);
  }
  return violations;
}

// In-memory, per-process cache of recently-served question text, keyed by
// exactly what makes a pool distinct (event + scope + the objective/section
// text). Resets on server restart — acceptable, this is a "don't repeat
// yourself in the same session" aid, not a durable record like the bulk
// generator's bank files. Capped per key so it can't grow unbounded.
const RECENT_QUESTIONS_CACHE = new Map();
const RECENT_QUESTIONS_CAP = 60;

function recentQuestionsKey(event, scope, objective) {
  return `${event}::${scope}::${objective}`;
}

function getRecentQuestions(event, scope, objective) {
  return RECENT_QUESTIONS_CACHE.get(recentQuestionsKey(event, scope, objective)) || [];
}

function rememberQuestions(event, scope, objective, questions) {
  const key = recentQuestionsKey(event, scope, objective);
  const existing = RECENT_QUESTIONS_CACHE.get(key) || [];
  const updated = existing.concat((questions || []).map(q => q.question)).slice(-RECENT_QUESTIONS_CAP);
  RECENT_QUESTIONS_CACHE.set(key, updated);
}

// Mirrors generate_bank.py's already_asked_block() exactly — same wording,
// same contract with RULE 8c in the shared rules file.
function alreadyAskedBlock(priorQuestions) {
  if (!priorQuestions || priorQuestions.length === 0) {
    return 'ALREADY ASKED IN THIS KNOWLEDGE AREA: (none yet — this is the first batch, no restrictions from prior questions.)';
  }
  const lines = priorQuestions.map((q, i) => `  ${i + 1}. ${q}`).join('\n');
  return `ALREADY ASKED IN THIS KNOWLEDGE AREA — every one of these facts is now OFF LIMITS, including asking about it again with different wording (RULE 8c):\n${lines}`;
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
  return sanitizeQuestion({
    question:       q.question,
    options:        { A: q.options[0], B: q.options[1], C: q.options[2], D: q.options[3] },
    answer:         letters[q.correct_index],
    explanation:    q.explanation,
    knowledge_area: q.knowledge_area,
    difficulty:     q.difficulty,
  });
}

// ---------------------------------------------------------------------------
// Defense-in-depth against leaked answer-indicators (RULE 4f). The rules-file
// fix (removing inline "✓" markers from illustrative examples, which the
// model was literally copying into real option text) addresses the root
// cause, but this strips any indicator that slips through anyway — whether
// from a fresh AI response or an already-baked pre-generated bank file.
// Applied on every serving path (bank AND live) so it can never regress.
// ---------------------------------------------------------------------------
const ANSWER_INDICATOR_RE = /\s*(?:✓|✔|☑|✅|\*+|\(\s*correct\s*\)|\[\s*correct\s*\]|<-+\s*correct)\s*$/i;
function stripAnswerIndicators(text) {
  if (!text) return text;
  let cleaned = String(text);
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(ANSWER_INDICATOR_RE, '').trimEnd();
  } while (cleaned !== prev);
  return cleaned;
}
function sanitizeQuestion(q) {
  if (!q || !q.options) return q;
  const options = {};
  for (const k of Object.keys(q.options)) options[k] = stripAnswerIndicators(q.options[k]);
  return { ...q, options };
}
function sanitizeQuestions(questions) {
  return (questions || []).map(sanitizeQuestion);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Each scope has its own pre-generated bank size. The bank is only ever
// served when the request asks for exactly that many questions — anything
// smaller generates fresh so it isn't just a random subset of the bigger
// pre-generated pool.
const SCOPE_BANK_MAX = { event: 50, section: 25, objective: 15 };
const SCOPE_BANK_FILENAME = { section: 'question-bank-sections.json', objective: 'question-bank-objectives.json' };

// Serve `count` questions from the pre-generated section/objective bank, if
// one exists for this event and the request's objective text resolves to a
// pool in it. Returns null (never throws) on any miss — the caller always
// falls through to live generation, same as the event-tier path.
function serveScopedBank(event, scope, objective, difficulty) {
  const filename = SCOPE_BANK_FILENAME[scope];
  if (!filename) return null;
  const bankPath = path.join(MATERIALS_DIR, event, filename);
  if (!fs.existsSync(bankPath)) return null;

  let data;
  try { data = JSON.parse(fs.readFileSync(bankPath, 'utf8')); }
  catch { return null; }

  let pool = null;
  if (scope === 'objective') {
    // Objective-scope requests send the raw objective sentence verbatim —
    // it's the exact key generate_bank.py used when building this pool.
    pool = data[objective] || null;
  } else if (scope === 'section') {
    // Section-scope requests send "A. Title: obj1; obj2; ..." (see
    // buildSectionText in App.jsx) — pull out just the title to match the
    // bank's section-name keys.
    const m = (objective || '').match(/^[A-Z]{1,2}\.\s+(.+?):\s/);
    pool = m ? (data[m[1]] || null) : null;
  }
  if (!pool || pool.length === 0) return null;

  let filtered = pool;
  if (difficulty) {
    const byDiff = pool.filter(q => q.difficulty === difficulty);
    if (byDiff.length) filtered = byDiff;
  }
  return shuffle(filtered).map(bankToQuizFormat);
}

// Mirrors generate_bank.py's difficulty_tier() exactly, so on-the-fly
// generation is calibrated by RULE 1B the same way bulk generation is —
// every "introduction-to-*" event is INTRO tier, everything else STANDARD.
function difficultyTier(event) {
  return (event || '').startsWith('introduction-to-') ? 'INTRO' : 'STANDARD';
}

// Serve the full pre-generated bank for an exact-max-count event request.
// Returns an array of quiz-format questions, or null if the bank is missing.
function serveFromBank(event, difficulty) {
  const bank = loadBank(event);
  if (!bank || bank.length === 0) return null;

  // Prefer questions matching the requested difficulty, but never fail just
  // because the bank doesn't stock that difficulty — fall back to everything.
  let pool = bank;
  if (difficulty) {
    const byDiff = bank.filter(q => q.difficulty === difficulty);
    if (byDiff.length) pool = byDiff;
  }

  return shuffle(pool).map(bankToQuizFormat);
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

function buildGenPrompt(type, count, objective, outline, difficulty, extras = '', event = '', alreadyAsked = []) {
  const studyBlock = [
    outline ? `--- EVENT OUTLINE ---\n${outline.slice(0, 1500).trim()}` : '',
    extras  ? `--- STUDY CONTENT ---\n${extras.slice(0, 3000).trim()}`  : '',
  ].filter(Boolean).join('\n\n');

  if (type === 'quiz') {
    return `${GEN_RULES}

--- TASK ---
Output ONLY a valid JSON array. No text before or after the array.

Event: ${event}
Difficulty tier: ${difficultyTier(event)} — follow RULE 1B's distribution for
this tier exactly. Do not drift toward "hard" as a goal; match what would
realistically appear on this specific event's real objective test.

Generate exactly ${count} multiple-choice questions about: "${objective}"
${studyBlock ? `\n${studyBlock}\n` : ''}
${alreadyAskedBlock(alreadyAsked)}

Every question — including every one of the ${count} you write in THIS
response relative to each other — must test a genuinely different fact.
Format — every object must have these exact keys:
[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"2-3 sentences: why correct and why the wrong choices are wrong","knowledge_area":"topic area","difficulty":"${difficulty}"}]

Rules:
- "answer" must be exactly A, B, C, or D
- No text outside the array
- The array MUST end with ]
- LAST CHECK BEFORE YOU RESPOND, ONE OPTION AT A TIME: every wrong option
  must be POWERFUL, CLEAR, and TEMPTING — not too short, not crazy, just
  reasonable enough that a student who almost knows this material would
  seriously consider picking it. A distractor that's a one-word throwaway
  or an extreme/absurd choice is not a distractor, it's a hint. Fix any
  option that fails this before outputting.`;
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

// Quiz generation — serves from the pre-generated bank only when the request
// asks for exactly that scope's full bank size; every other count generates
// fresh with AI so it's never just a sampled subset of the bigger bank.
app.post('/api/quiz', async (req, res) => {
  const { event, objective, count, difficulty, scope } = req.body;
  console.log(`[quiz] event=${event} scope=${scope} count=${count} difficulty=${difficulty} objective="${objective?.slice(0,60)}"`);

  // Fast path: exact-max-count request — serve the pre-generated bank for
  // this scope, if one exists and has a matching pool.
  if (scope === 'event' && count === SCOPE_BANK_MAX.event) {
    const banked = serveFromBank(event, difficulty);
    if (banked) {
      console.log(`[bank] serving ${banked.length} ${difficulty} questions for ${event}`);
      return res.json({ questions: banked, source: 'bank' });
    }
    console.log(`[bank] miss — falling through to AI`);
  } else if ((scope === 'section' || scope === 'objective') && count === SCOPE_BANK_MAX[scope]) {
    const banked = serveScopedBank(event, scope, objective, difficulty);
    if (banked) {
      console.log(`[bank] serving ${banked.length} ${difficulty} ${scope} questions for ${event}`);
      return res.json({ questions: banked, source: 'bank' });
    }
    console.log(`[bank] miss (${scope}) — falling through to AI`);
  }

  // Slow path: generate with AI
  const outline = extractRelevantSection(getOutline(event), objective);
  const extras  = getExtras(event);
  const priorQuestions = getRecentQuestions(event, scope, objective);
  const prompt = buildGenPrompt('quiz', count, objective, outline, difficulty, extras, event, priorQuestions);

  // Track the least-bad attempt across retries so a request NEVER hard-fails
  // just because of these mechanical checks — a quiz with one imperfect
  // question beats no quiz at all. The checks still drive real retries first.
  //
  // Ranked by [dupeCount, lengthCount] lexicographically, NOT a flat sum — a
  // real bug shipped in generate_bank.py's identical logic where a 3-attempt
  // tie (1 dupe on attempt 1, 1 length-tell on attempts 2 and 3 — all "1
  // total violation") kept attempt 1 by default (first-seen wins ties under
  // strict <), landing an actual duplicate question in a live bank. A
  // duplicate is strictly worse than a length-tell (a wasted, unusable
  // question vs. a partial quality issue), so it must never lose a
  // tie-break to one. Mirrored here since this path has the same shape.
  let bestAttempt = null;
  let bestRank = null;
  const rankOf = (dupeCount, lengthCount) => [dupeCount, lengthCount];
  const rankLess = (a, b) => a[0] !== b[0] ? a[0] < b[0] : a[1] < b[1];

  try {
    const questions = await withRetry(async () => {
      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(count * 350, 16384) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      const parsed = sanitizeQuestions(extractJSON(raw));
      const lengthViolations = findLengthTellViolations(parsed);
      const dupeViolations   = findDuplicateViolations(parsed);
      const rank = rankOf(dupeViolations.length, lengthViolations.length);

      if (!bestRank || rankLess(rank, bestRank)) {
        bestAttempt = parsed;
        bestRank = rank;
      }
      if (dupeViolations.length || lengthViolations.length) {
        const reasons = [];
        if (lengthViolations.length) reasons.push(`${lengthViolations.length} length-tell`);
        if (dupeViolations.length)   reasons.push(`${dupeViolations.length} duplicate`);
        console.warn(`[quiz] ${reasons.join(', ')} violation(s) — retrying: "${(lengthViolations[0] || dupeViolations[0]).question.slice(0, 60)}..."`);
        throw new Error('Generated questions failed quality checks — retrying');
      }
      return parsed;
    });
    rememberQuestions(event, scope, objective, questions);
    res.json({ questions: questions.slice(0, count), source: 'ai' });
  } catch (err) {
    if (bestAttempt) {
      const [dupeN, lengthN] = bestRank;
      console.warn(`[quiz] all attempts had violations — serving least-bad available (${dupeN} duplicate, ${lengthN} length-tell)`);
      rememberQuestions(event, scope, objective, bestAttempt);
      return res.json({ questions: bestAttempt.slice(0, count), source: 'ai' });
    }
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
const server = app.listen(PORT, () => console.log(`StudyStock — provider: ${PROVIDER} — port: ${PORT}`));
server.on('error', (err) => console.error('[server] listen error:', err));

// Guaranteed keep-alive: if the listen handle somehow isn't holding the event
// loop open in this environment, this timer will, so the process can't exit 0.
setInterval(() => {}, 1 << 30);

// Diagnostics — surface exactly how/if the process ever stops.
process.on('beforeExit', (code) => console.log('[server] beforeExit (event loop drained) code', code));
process.on('exit',        (code) => console.log('[server] exit code', code));
process.on('uncaughtException',  (err) => console.error('[server] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[server] unhandledRejection:', err));
