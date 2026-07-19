import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { listEvents as listPresentationEvents } from './services/scriptGrader.js';
import { runWorkbot } from './services/presentationOrchestrator.js';
import { inputOptionsFor } from './services/tabConfig.js';

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
const REPO_ROOT        = path.join(__dirname, '..');

// Org/event slugs are folder names used directly in path.join() below —
// whitelist to plain slug characters so a request can never escape
// MATERIALS_DIR via a crafted "org" or "event" value.
const SAFE_SLUG_RE = /^[a-zA-Z0-9_-]+$/;
function isSafeSlug(s) {
  return typeof s === 'string' && SAFE_SLUG_RE.test(s);
}

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
  // General/"Ask Anything" mode calls this with objectiveText === '' (no
  // single objective to scope to) — there's nothing to match against, so
  // this must return the FULL outline. Without this early return, an empty
  // objectiveText produced zero match words, `sections.find()` never
  // matched anything, and the code fell through to `sections[0]` — which
  // is not "a reasonable default section", it's whatever text precedes the
  // outline's first "A. " heading (title, format, eligibility, event
  // description preamble) with NO actual knowledge areas or objectives in
  // it. The model then received that near-empty preamble as its entire
  // source material for a general question and, accurately but unhelpfully,
  // reported the outline as blank instead of answering.
  if (!objectiveText || !objectiveText.trim()) return outlineText;

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
  return match || outlineText;
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

function answerText(q) {
  const letter = q && q.answer;
  return (q && q.options && letter) ? (q.options[letter] || '') : '';
}

// Generic "wrapper" words that vary between two phrasings of the SAME fact
// (e.g. "antivirus program" vs "antivirus software") — stripped before
// comparing concept words so they don't count as the meaningful part of the
// answer. Deliberately does NOT include words like "storage", "data",
// "network", "information", "security" — those ARE meaningful differentiators
// ("local storage" vs "cloud storage" are genuinely different facts and must
// never be flagged as the same concept). Mirrors generate_bank.py exactly.
const GENERIC_ANSWER_WORDS = new Set([
  'software', 'program', 'programs', 'tool', 'tools', 'utility', 'utilities',
  'system', 'systems', 'application', 'applications', 'service', 'services',
  'feature', 'features', 'technology', 'technologies', 'method', 'methods',
  'practice', 'practices', 'measure', 'measures', 'process', 'processes',
  'management', 'manager', 'control', 'controls', 'planning', 'protection',
  'capability', 'capabilities', 'function', 'functions', 'operation',
  'operations', 'concept', 'concepts', 'type', 'types', 'device', 'devices',
]);

// Reduce an answer's text to its core concept word(s) for duplicate-FACT
// detection (distinct from findDuplicateViolations's exact-text check).
// A mechanical PROXY for "is this the same underlying fact", not true
// semantic understanding — verified against every real case found in a
// manual 175-question review (antivirus, backup, defragmentation, caching,
// virtualization, copyright, information security, data collection, and
// database operations/management were each tested 2+ times per 25-question
// pool with different wording, none caught by exact-text matching), plus a
// stress test to avoid flagging legitimately different facts that share a
// word (e.g. "local storage" vs "cloud storage" must NOT match).
function conceptWords(text) {
  const words = (text || '').toLowerCase().match(/[a-z]+/g) || [];
  return new Set(words.filter(w => w.length >= 4 && !GENERIC_ANSWER_WORDS.has(w)));
}

// Two words "match" if identical, or — ONLY when both are at least
// fuzzyFloor characters long — share a >=minLen-character prefix (catches
// word-form variants like "defragmentation"/"defragmenter" or
// "caching"/"cache" without needing real stemming). The fuzzyFloor guard is
// load-bearing: without it, a short word like "data" (4 chars) prefix-
// matches "database" (also starts "data") even though they're different
// concepts — a real false-positive storm found in review, where 5 unrelated
// questions (data governance, data selling, data breaches, network
// encryption, data loss) all got flagged as duplicates of a "database"
// question purely because they each contained some word starting with
// "data". Below the floor, only an EXACT match counts. Mirrors
// generate_bank.py's _word_fuzzy_match exactly.
function wordsFuzzyMatch(a, b, minLen = 4, fuzzyFloor = 5) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < fuzzyFloor) return false;
  return a.slice(0, minLen) === b.slice(0, minLen);
}

// Words too common/generic WITHIN this IT-heavy source material to trust as
// a lone, single-word match signal — e.g. "file" alone shows up in "file
// system", "file permissions", "file compression", "file sharing", none of
// which are the same fact. Unlike GENERIC_ANSWER_WORDS (stripped
// everywhere), these words still count as part of a MULTI-word concept set
// — they're only disqualified from single-handedly triggering a match on
// their own. Mirrors generate_bank.py's WEAK_ANCHOR_WORDS exactly.
const WEAK_ANCHOR_WORDS = new Set([
  'file', 'files', 'data', 'access', 'user', 'users', 'resource',
  'resources', 'operating', 'information', 'network', 'networks', 'digital',
]);

// True if every word in `small` has a fuzzy match somewhere in `big`. A
// single-word `small` set is refused if that word is a weak anchor — either
// the static WEAK_ANCHOR_WORDS list, or `extraWeak` (see dynamicWeakWords
// below) — one generic word incidentally appearing inside an unrelated
// answer is not enough evidence of a real duplicate.
function setCovered(small, big, extraWeak) {
  extraWeak = extraWeak || new Set();
  if (small.size === 0) return false;
  if (small.size === 1) {
    const w = [...small][0];
    if (WEAK_ANCHOR_WORDS.has(w) || extraWeak.has(w)) return false;
  }
  for (const w of small) {
    if (![...big].some(bw => wordsFuzzyMatch(w, bw))) return false;
  }
  return true;
}

// Words that show up in many prior answers within THIS event/pool are too
// common to trust as a lone match signal — same principle as the static
// WEAK_ANCHOR_WORDS list, but computed per-event instead of hardcoded.
// WEAK_ANCHOR_WORDS was hand-curated from IT-domain false positives ("file",
// "operating", "data") and does NOT generalize — proven by a real failure:
// Parliamentary Procedure flagged 22 false concept-repeats out of 50
// event-tier questions, almost all because "motion" (that event's single
// most central term, not anticipated by an IT-derived list) trivially
// matched any answer that happened to mention it. Mirrors
// generate_bank.py's dynamic_weak_words exactly.
function dynamicWeakWords(priorAnswers, minCount = 3, minFrac = 0.15) {
  const counts = new Map();
  for (const a of priorAnswers) {
    for (const w of conceptWords(a)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  const total = Math.max(priorAnswers.length, 1);
  const threshold = Math.max(minCount, Math.floor(total * minFrac));
  return new Set([...counts.entries()].filter(([, c]) => c >= threshold).map(([w]) => w));
}

function isConceptRepeat(textA, textB, extraWeak) {
  const a = conceptWords(textA), b = conceptWords(textB);
  if (a.size === 0 || b.size === 0) return false;
  return setCovered(a, b, extraWeak) || setCovered(b, a, extraWeak);
}

// Catches two DIFFERENT failure modes:
//   1. EXACT/near-exact question-TEXT repeats (normalized string match) —
//      the original check.
//   2. CONCEPT repeats — the SAME underlying fact retested with different
//      wording, which (1) can never catch. Real, severe failure found by a
//      manual review: one 25-question pool had copyright defined twice,
//      information security defined twice, data collection defined twice,
//      database operations/management defined twice, and a
//      disaster-recovery theme spanning 5 of 25 questions — NONE of them
//      exact-text matches. Mirrors generate_bank.py's identical fix exactly.
// `priorQuestions` is the list of full prior question objects (not just
// text) so both question-text and correct-answer text are available.
function findDuplicateViolations(questions, priorQuestions) {
  priorQuestions = priorQuestions || [];
  const seenText = new Set(priorQuestions.map(p => normalizeQuestionText(p.question)));
  const seenAnswers = priorQuestions.map(answerText).filter(Boolean);
  const extraWeak = dynamicWeakWords(seenAnswers);
  const violations = [];
  const batchAnswers = [];
  for (const q of (questions || [])) {
    const norm = normalizeQuestionText(q.question);
    const ans = answerText(q);
    const isTextDupe = seenText.has(norm);
    const isConceptDupe = Boolean(ans) && (
      seenAnswers.some(prior => isConceptRepeat(ans, prior, extraWeak)) ||
      batchAnswers.some(prev => isConceptRepeat(ans, prev, extraWeak))
    );
    if (isTextDupe || isConceptDupe) {
      violations.push(q);
    } else {
      seenText.add(norm);
      if (ans) batchAnswers.push(ans);
    }
  }
  return violations;
}

// In-memory, per-process cache of recently-served full question objects,
// keyed by exactly what makes a pool distinct (event + scope + the
// objective/section text). Resets on server restart — acceptable, this is a
// "don't repeat yourself in the same session" aid, not a durable record
// like the bulk generator's bank files. Capped per key so it can't grow
// unbounded. Stores full objects (not just question text) so the
// concept-repeat check has access to each prior answer's text too.
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
  const updated = existing.concat(questions || []).slice(-RECENT_QUESTIONS_CAP);
  RECENT_QUESTIONS_CACHE.set(key, updated);
}

// Mirrors generate_bank.py's already_asked_block() exactly — same wording,
// same contract with RULE 8c in the shared rules file. Includes both the
// prior question text AND an explicit list of prior correct-answer concepts
// — the question-text list alone was proven insufficient (the model doesn't
// reliably recognize its own reworded version as "the same thing" from
// question text alone; naming the exact answer CONCEPT directly is a much
// harder-to-ignore signal). `priorQuestions` is the list of full prior
// question objects (needs both .question and .options/.answer).
function alreadyAskedBlock(priorQuestions) {
  if (!priorQuestions || priorQuestions.length === 0) {
    return 'ALREADY ASKED IN THIS KNOWLEDGE AREA: (none yet — this is the first batch, no restrictions from prior questions.)';
  }
  const qLines = priorQuestions.map((q, i) => `  ${i + 1}. ${q.question}`).join('\n');
  const answers = [...new Set(priorQuestions.map(answerText).filter(Boolean))];
  const aLines = answers.map(a => `  - ${a}`).join('\n');
  // Real observed slowdown (bulk path, mirrored here for parity): near the
  // end of a pool the model keeps re-reaching for the same "safe," obvious
  // facts and colliding with this list. Once it's substantial, give it
  // explicit permission to go narrower/more specific instead of defaulting
  // to something similar to what's already covered.
  const narrowHint = priorQuestions.length >= 8
    ? `\n\nThis pool already has a substantial number of facts covered. If you're struggling to find a genuinely new angle, it's fine — and expected — to test a more specific technical distinction, a narrower sub-detail, or an edge case within this topic, rather than defaulting to a fact similar to what's already listed above.`
    : '';
  return `ALREADY ASKED IN THIS KNOWLEDGE AREA — every one of these facts is now OFF LIMITS, including asking about it again with different wording (RULE 8c):
${qLines}

CORRECT ANSWERS ALREADY USED IN THIS POOL — do NOT write a new question whose correct answer is any of these concepts, even phrased completely differently or asked from a different angle. Pick a genuinely DIFFERENT fact from the source material instead:
${aLines}${narrowHint}`;
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

function loadBank(org, event) {
  const bankPath = path.join(MATERIALS_DIR, org, event, 'question-bank.json');
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
    // Only present on banks regenerated after per-objective breakdown was
    // added — older banks simply omit it, and the frontend falls back to
    // the plain score screen when any question in a section-scope quiz is
    // missing this field.
    objective_num:  q.objective_num,
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

// Each scope has its own pre-generated bank size — still used by
// generate_bank.py as its tier target, but no longer a hard requirement for
// serving from cache here (see loadQuizPool below).
const SCOPE_BANK_MAX = { event: 50, section: 20, objective: 10 };
const SCOPE_BANK_FILENAME = { section: 'question-bank-sections.json', objective: 'question-bank-objectives.json' };

// ---------------------------------------------------------------------------
// Shared "live cache" — whenever any user's request falls through to the AI
// (below in /api/quiz, /api/flashcards, /api/notes), the fresh result is
// saved here, per event, so every subsequent request for that same
// scope/objective is served straight from disk instead of paying for another
// generation. This is the same idea as the generate_bank.py-produced banks
// (question-bank*.json), just filled in lazily by live traffic instead of a
// bulk offline run — the two sources are simply unioned when serving.
// ---------------------------------------------------------------------------
function liveCachePath(org, event, filename) {
  return path.join(MATERIALS_DIR, org, event, filename);
}
function loadLiveCache(org, event, filename) {
  const p = liveCachePath(org, event, filename);
  if (!fs.existsSync(p)) return {};
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
  } catch { return {}; }
}
function saveLiveCache(org, event, filename, data) {
  try { fs.writeFileSync(liveCachePath(org, event, filename), JSON.stringify(data, null, 2)); }
  catch (err) { console.error(`[live-cache] failed to save ${filename}:`, err.message); }
}

// Section-scope requests send "A. Title: obj1; obj2; ..." (see
// buildSectionText in App.jsx) — pull out just the title so both the real
// bank and the live cache key off the same short, stable string.
function sectionCacheKey(objective) {
  const m = (objective || '').match(/^[A-Z]{1,2}\.\s+(.+?):\s/);
  return m ? m[1] : (objective || '__section__');
}

const LIVE_QUIZ_CACHE_FILE = {
  event:     'question-bank.live.json',
  section:   'question-bank-sections.live.json',
  objective: 'question-bank-objectives.live.json',
};

function quizCacheKey(scope, objective) {
  if (scope === 'event') return '__event__';
  if (scope === 'section') return sectionCacheKey(objective);
  return objective || '__objective__';
}

// Returns the merged (real bank ∪ live cache), quiz-format, unshuffled pool
// for a scope. Never throws; empty array on total miss.
function loadQuizPool(org, event, scope, objective) {
  let bankPool = [];
  if (scope === 'event') {
    const bank = loadBank(org, event);
    if (bank) bankPool = bank.map(bankToQuizFormat);
  } else {
    const filename = SCOPE_BANK_FILENAME[scope];
    const bankPath = filename && path.join(MATERIALS_DIR, org, event, filename);
    if (bankPath && fs.existsSync(bankPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(bankPath, 'utf8'));
        const raw = scope === 'objective' ? (data[objective] || null) : (data[sectionCacheKey(objective)] || null);
        if (raw) bankPool = raw.map(bankToQuizFormat);
      } catch { /* fall through with empty bankPool */ }
    }
  }

  const liveFile = LIVE_QUIZ_CACHE_FILE[scope];
  const livePool = liveFile ? (loadLiveCache(org, event, liveFile)[quizCacheKey(scope, objective)] || []) : [];
  if (!livePool.length) return bankPool;

  const seen = new Set(bankPool.map(q => normalizeQuestionText(q.question)));
  const merged = bankPool.slice();
  for (const q of livePool) {
    const k = normalizeQuestionText(q.question);
    if (!seen.has(k)) { seen.add(k); merged.push(q); }
  }
  return merged;
}

// Serve `count` questions straight from the merged pool if it already has
// enough matching-difficulty questions — no AI call needed. Returns null
// (never throws) on any miss, so the caller always falls through to live
// generation.
function serveQuizFromPool(org, event, scope, objective, difficulty, count) {
  const pool = loadQuizPool(org, event, scope, objective);
  if (!pool.length) return null;
  let filtered = pool;
  if (difficulty) {
    const byDiff = pool.filter(q => q.difficulty === difficulty);
    if (byDiff.length) filtered = byDiff;
  }
  if (filtered.length < count) return null;
  return shuffle(filtered).slice(0, count);
}

// Folds freshly AI-generated questions into the live cache pool for this
// scope/objective, deduped against whatever's already there (bank or live),
// so the next request for this exact scope/objective — from any user — can
// be served from disk instead of generating again.
function mergeIntoLiveQuizCache(org, event, scope, objective, freshQuestions) {
  const liveFile = LIVE_QUIZ_CACHE_FILE[scope];
  if (!liveFile || !freshQuestions.length) return;
  const key = quizCacheKey(scope, objective);
  const cache = loadLiveCache(org, event, liveFile);
  const existingPool = cache[key] || [];
  // Dedupe against the FULL merged pool (bank + live), not just live, so a
  // question that already exists in the real bank never gets re-saved here.
  const seen = new Set(loadQuizPool(org, event, scope, objective).map(q => normalizeQuestionText(q.question)));
  const merged = existingPool.slice();
  for (const q of freshQuestions) {
    const k = normalizeQuestionText(q.question);
    if (!seen.has(k)) { seen.add(k); merged.push(q); }
  }
  cache[key] = merged;
  saveLiveCache(org, event, liveFile, cache);
}

// Mirrors generate_bank.py's difficulty_tier() exactly, so on-the-fly
// generation is calibrated by RULE 1B the same way bulk generation is —
// every "introduction-to-*" event is INTRO tier, everything else STANDARD.
function difficultyTier(event) {
  return (event || '').startsWith('introduction-to-') ? 'INTRO' : 'STANDARD';
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

app.get('/api/orgs', (req, res) => {
  const orgs = fs.readdirSync(MATERIALS_DIR)
    .filter(f => fs.statSync(path.join(MATERIALS_DIR, f)).isDirectory())
    .map(org => {
      const orgDir = path.join(MATERIALS_DIR, org);
      const eventCount = fs.readdirSync(orgDir)
        .filter(f => fs.statSync(path.join(orgDir, f)).isDirectory())
        .length;
      return { id: org, eventCount };
    });
  res.json(orgs.sort((a, b) => a.id.localeCompare(b.id)));
});

app.get('/api/events', (req, res) => {
  const org = req.query.org;
  if (!org || !isSafeSlug(org)) return res.json([]);
  const orgDir = path.join(MATERIALS_DIR, org);
  if (!fs.existsSync(orgDir)) return res.json([]);
  const events = fs.readdirSync(orgDir)
    .filter(f => fs.statSync(path.join(orgDir, f)).isDirectory());
  res.json(events.sort());
});

app.get('/api/events/:org/:event/outline', (req, res) => {
  const { org, event } = req.params;
  if (!isSafeSlug(org) || !isSafeSlug(event)) return res.status(400).json({ error: 'Invalid org or event' });
  const outlinePath = path.join(MATERIALS_DIR, org, event, 'event-outline.txt');
  const contentPath = path.join(MATERIALS_DIR, org, event, 'study-content.txt');
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

function getOutline(org, event) {
  const p  = path.join(MATERIALS_DIR, org, event, 'event-outline.txt');
  const p2 = path.join(MATERIALS_DIR, org, event, 'event-outline 2.txt');
  let content = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  if (fs.existsSync(p2)) content += '\n\n' + fs.readFileSync(p2, 'utf8');
  return content;
}

function getExtras(org, event) {
  return ['notes.txt', 'vocab.txt', 'mistakes.txt', 'study-content.txt']
    .map(f => path.join(MATERIALS_DIR, org, event, f))
    .filter(fs.existsSync)
    .map(f => `--- ${path.basename(f)} ---\n${fs.readFileSync(f, 'utf8')}`)
    .join('\n\n');
}

function buildSystemPrompt(org, event, objectiveText, mode) {
  const botRules = fs.readFileSync(BOT_RULES_PATH, 'utf8');
  const outline  = getOutline(org, event);
  const section  = extractRelevantSection(outline, objectiveText);
  const extras   = getExtras(org, event);
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

// Everything before this marker in a quiz prompt is GEN_RULES — the static
// rules-file text, byte-identical on every call — so we cache it. Everything
// after is the per-request variable content (event, objective, already-asked
// memory, etc). Mirrors generate_bank.py's identical optimization exactly:
// the API concatenates the two text blocks back into EXACTLY the original
// prompt, so the model sees identical input and output behavior is
// unchanged — only the repeated prefix is billed cheaper. Flashcard prompts
// don't contain this marker (they don't include GEN_RULES at all), so they
// safely fall through to the original single-string behavior, unaffected.
const CACHE_SPLIT_MARKER = '--- TASK ---';
function buildMessageContent(prompt) {
  const idx = prompt.indexOf(CACHE_SPLIT_MARKER);
  if (idx <= 0) return prompt;
  return [
    { type: 'text', text: prompt.slice(0, idx), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: prompt.slice(idx) },
  ];
}

async function callAnthropic(prompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 4096,
    messages: [{ role: 'user', content: buildMessageContent(prompt) }],
  });
  return msg.content[0].text;
}

async function streamAnthropic(systemPrompt, messages, res) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Anthropic's "overloaded_error" is explicitly transient (their own docs
  // recommend retrying) — worth one silent automatic retry, but ONLY before
  // any real content has reached the client. Once even one token has been
  // written, a retry would restart the reply from scratch while the first
  // half is already visible, so from that point on a failure just propagates
  // to the normal catch in the route handler instead.
  let wroteAny = false;
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const stream = await client.messages.stream({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1024, system: systemPrompt, messages,
      });
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          wroteAny = true;
          res.write(`data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`);
        }
      }
      return;
    } catch (err) {
      const overloaded = err?.error?.error?.type === 'overloaded_error' || /overloaded/i.test(err?.message || '');
      if (wroteAny || !overloaded || attempt === maxAttempts) throw err;
      console.warn(`[chat] Anthropic overloaded, retrying (attempt ${attempt + 1}/${maxAttempts})`);
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

// One entry per objective in a section — falls back to the objective's own
// number/text if the model dropped a field, so a single malformed entry
// never silently disappears from the notes page.
function normalizeNotes(notes, objectivesList) {
  return notes
    .map((n, i) => ({
      objective_num: Number(n.objective_num ?? objectivesList[i]?.num ?? i + 1),
      heading: String(n.heading ?? n.title ?? '').trim(),
      body: String(n.body ?? n.text ?? n.explanation ?? '').trim(),
    }))
    .filter(n => n.body);
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildGenPrompt(type, count, objective, outline, difficulty, extras = '', event = '', alreadyAsked = [], objectivesList = null) {
  const studyBlock = [
    outline ? `--- EVENT OUTLINE ---\n${outline.slice(0, 1500).trim()}` : '',
    extras  ? `--- STUDY CONTENT ---\n${extras.slice(0, 3000).trim()}`  : '',
  ].filter(Boolean).join('\n\n');

  if (type === 'quiz') {
    // Section-scope requests pass the section's individual objectives so
    // every question can be tagged with the one it tests — this is what
    // powers the per-objective results breakdown. Event/objective-scope
    // requests pass null and skip this entirely (event-scope breakdown
    // uses the existing knowledge_area field instead; objective-scope
    // doesn't need a breakdown at all).
    const objectivesBlock = (objectivesList && objectivesList.length) ? `
--- OBJECTIVES IN THIS SECTION ---
Tag every question with "objective_num" — the number of the ONE objective
below that it most directly tests. Use ONLY these exact numbers, and pick
the single best match even if a question could loosely touch more than one:
${objectivesList.map(o => `${o.num}. ${o.text}`).join('\n')}
` : '';

    return `${GEN_RULES}

--- TASK ---
Output ONLY a valid JSON array. No text before or after the array.

Event: ${event}
Difficulty tier: ${difficultyTier(event)} — follow RULE 1B's distribution for
this tier exactly. Do not drift toward "hard" as a goal; match what would
realistically appear on this specific event's real objective test.

Generate exactly ${count} multiple-choice questions about: "${objective}"
${studyBlock ? `\n${studyBlock}\n` : ''}
${objectivesBlock}
${alreadyAskedBlock(alreadyAsked)}

Every question — including every one of the ${count} you write in THIS
response relative to each other — must test a genuinely different fact.
Format — every object must have these exact keys${objectivesBlock ? ' (including "objective_num")' : ''}:
[{"question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"answer":"A","explanation":"2-3 sentences: why correct and why the wrong choices are wrong","knowledge_area":"topic area","difficulty":"${difficulty}"${objectivesBlock ? ',"objective_num":1' : ''}}]

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

  if (type === 'notes') {
    return `Output ONLY a valid JSON array. No text before or after the array.

Generate exactly ${objectivesList.length} study-note entries, one for each
objective below, in the same order — this is a one-page study document
covering an entire section, not a single-objective explanation:
${objectivesList.map(o => `${o.num}. ${o.text}`).join('\n')}
${studyBlock ? `\n${studyBlock}\n` : ''}
Format — every object must have these exact keys:
[{"objective_num":1,"heading":"short 3-6 word title","body":"3-5 sentences of substantive, concrete study notes for this objective — real terms, examples, numbers, or formulas a student needs, written like clean study notes, not a restatement of the objective itself"}]

Rules:
- Exactly ${objectivesList.length} entries, one per objective, in the same order, each tagged with its matching objective_num
- "heading" is short and scannable, distinct from the objective's own wording
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

// Quiz generation — serves from the pre-generated bank only when the request
// asks for exactly that scope's full bank size; every other count generates
// fresh with AI so it's never just a sampled subset of the bigger bank.
app.post('/api/quiz', async (req, res) => {
  const { org, event, objective, count, difficulty, scope, objectives } = req.body;
  if (!isSafeSlug(org) || !isSafeSlug(event)) return res.status(400).json({ error: 'Invalid org or event' });
  console.log(`[quiz] org=${org} event=${event} scope=${scope} count=${count} difficulty=${difficulty} objective="${objective?.slice(0,60)}"`);

  // Fast path: serve straight from the merged (real bank ∪ live cache) pool
  // whenever it already has enough matching questions — no AI call needed,
  // for ANY count, not just an exact tier match. The live cache is filled in
  // below whenever a request DOES fall through to AI, so a given
  // scope/objective/difficulty combo only ever needs to be generated once,
  // globally, across every user.
  const banked = serveQuizFromPool(org, event, scope, objective, difficulty, count);
  if (banked) {
    console.log(`[bank] serving ${banked.length} ${difficulty || ''} ${scope} questions for ${event}`);
    return res.json({ questions: banked, source: 'bank' });
  }
  console.log(`[bank] miss (${scope}, count=${count}) — falling through to AI`);

  // Slow path: generate with AI
  const outline = extractRelevantSection(getOutline(org, event), objective);
  const extras  = getExtras(org, event);
  const priorQuestions = getRecentQuestions(event, scope, objective);
  const objectivesList = scope === 'section' && Array.isArray(objectives) ? objectives : null;

  // SURGICAL RETRY, not whole-batch retry — mirrors generate_bank.py's
  // identical fix exactly. Old behavior: if even 1 of `count` questions had
  // a violation, the WHOLE batch was thrown away and a fresh `count` was
  // requested from scratch (full rules-file resend + full output, paid
  // again, to redo work that was mostly already fine). Now each retry only
  // asks for the remaining GAP (count - kept.length so far), with the
  // kept-good questions folded into the already-asked memory so they can't
  // be re-asked. This is a pure cost win with a quality win attached: the
  // old "least-bad available, violations and all" fallback is gone — every
  // question that ships now individually passed every check, even if that
  // means occasionally shipping fewer than `count` questions after
  // exhausting retries, never a flawed one.
  //
  // Seeded from whatever the live cache already has for this exact
  // scope/objective, even if it's short of `count` — the fast path above
  // only serves when the pool FULLY satisfies the request, so a topic that
  // has repeatedly fallen a question or two short (see findDuplicateViolations
  // below — narrow objectives are the most prone to this) would otherwise
  // have its accumulated progress thrown away and regenerated from scratch
  // on every single request, forever. Folding it into `kept` up front means
  // it counts toward `remaining` immediately and only the true gap gets
  // generated.
  const pool = loadQuizPool(org, event, scope, objective);
  const poolByDiff = difficulty ? pool.filter(q => q.difficulty === difficulty) : pool;
  let kept = shuffle(poolByDiff.length ? poolByDiff : pool).slice(0, count);
  const seededFromCache = kept.length;
  if (seededFromCache) {
    console.log(`[bank] partial hit — seeding ${seededFromCache}/${count} from live cache, generating the rest`);
  }

  // Larger scopes need more attempts to converge. A flat 3-attempt budget
  // was calibrated for 10-20 question gaps (objective/section scope); a
  // 50-question event-scope quiz can shed enough length-tell/duplicate
  // violations per batch — especially on dense clinical/technical content —
  // that 3 attempts silently returns a fraction of what was requested
  // (e.g. 11/50) with no indication to the caller that it fell short.
  const retryBudget = Math.max(3, Math.ceil(count / 5) * 2);

  try {
    await withRetry(async () => {
      const remaining = count - kept.length;
      // Over-request whenever this is a gap-fill, not just when the gap is
      // tiny — mirrors generate_bank.py's identical fix, widened after
      // production logs showed a fresh 3-question retry (remaining=3 out of
      // count=5, no seed) come back 3/3 duplicates twice in a row. Asking
      // for exactly `remaining` on a narrow, fact-limited objective gives
      // the model no slack to avoid the concepts it just used a moment ago;
      // a small buffer gives it more surface area to find enough genuinely
      // distinct ones in one shot. Only the very first attempt on a
      // completely fresh topic (remaining === count, nothing seeded or kept
      // yet) skips the buffer, since there's no "just used" context yet to
      // need slack from. Never exceeds the original requested count.
      // Surplus beyond `remaining` is trimmed by the existing
      // `good.slice`-equivalent logic below (kept only grows by what's
      // still needed via the final `.slice(0, count)` on `kept`).
      const requestN = remaining >= count ? remaining : Math.min(count, remaining + 2);
      const extraPrior = priorQuestions.concat(kept);
      const prompt = buildGenPrompt('quiz', requestN, objective, outline, difficulty, extras, event, extraPrior, objectivesList);

      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(requestN * 350, 16384) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      const parsed = sanitizeQuestions(extractJSON(raw));
      const lengthViolations = findLengthTellViolations(parsed);
      const dupeViolations   = findDuplicateViolations(parsed, extraPrior);
      const badSet = new Set([...lengthViolations, ...dupeViolations]);
      const good = parsed.filter(q => !badSet.has(q));

      if (badSet.size) {
        const reasons = [];
        if (lengthViolations.length) reasons.push(`${lengthViolations.length} length-tell`);
        if (dupeViolations.length)   reasons.push(`${dupeViolations.length} duplicate`);
        console.warn(`[quiz] ${reasons.join(', ')} violation(s) among ${parsed.length} — kept ${good.length} good, retrying just the gap`);
      }

      kept = kept.concat(good);
      if (kept.length < count) {
        throw new Error(`Only ${kept.length}/${count} clean questions so far — retrying for the rest`);
      }
    }, retryBudget);
  } catch (err) {
    if (!kept.length) {
      console.error('Quiz error:', err.message);
      return res.status(500).json({ error: err.message });
    }
    console.warn(`[quiz] only got ${kept.length}/${count} fully-clean questions after ${retryBudget} attempts (${seededFromCache} of those from cache) — serving the partial batch (every question shipped still individually passed all checks)`);
  }

  const questions = kept.slice(0, count);
  rememberQuestions(event, scope, objective, questions);
  // Save to the shared live cache so this exact scope/objective never has to
  // be regenerated by AI again — the next request (this user or any other)
  // hits the fast path above instead. Re-merging the seeded-from-cache
  // questions here too is a harmless no-op (mergeIntoLiveQuizCache dedupes
  // by question text), so no need to slice them out first.
  mergeIntoLiveQuizCache(org, event, scope, objective, questions);
  // `requested` lets the client tell a genuine partial batch (fewer clean
  // questions found than asked for) apart from a normal full response,
  // instead of silently treating whatever came back as "the whole quiz".
  res.json({ questions, requested: count, source: seededFromCache ? 'mixed' : 'ai' });
});

// Flashcard generation — retries up to 3 times total, slices to exact count
const FLASHCARD_CACHE_FILE = 'flashcards.live.json';
function flashcardCacheKey(objective) { return objective || '__general__'; }

app.post('/api/flashcards', async (req, res) => {
  const { org, event, objective, count } = req.body;
  if (!isSafeSlug(org) || !isSafeSlug(event)) return res.status(400).json({ error: 'Invalid org or event' });

  // Shared cache, same idea as the quiz live cache above: once enough cards
  // exist for this objective (from any prior user's request), serve
  // straight from disk instead of generating again.
  const cache = loadLiveCache(org, event, FLASHCARD_CACHE_FILE);
  const key = flashcardCacheKey(objective);
  const pool = cache[key] || [];
  if (pool.length >= count) {
    return res.json({ cards: shuffle(pool).slice(0, count), source: 'cache' });
  }

  const outline = extractRelevantSection(getOutline(org, event), objective);
  const extras  = getExtras(org, event);
  const needed  = count - pool.length;
  const prompt  = buildGenPrompt('flashcard', needed, objective, outline, '', extras);

  try {
    const parsed = await withRetry(async () => {
      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(needed * 200, 8192) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      return extractJSON(raw);
    });
    const fresh = normalizeCards(parsed);
    if (fresh.length === 0 && pool.length === 0) throw new Error('Model returned no usable flashcards');

    // Dedupe by front text before folding into the shared pool.
    const seen = new Set(pool.map(c => c.front.trim().toLowerCase()));
    const merged = pool.slice();
    for (const c of fresh) {
      const k = c.front.trim().toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); merged.push(c); }
    }
    cache[key] = merged;
    saveLiveCache(org, event, FLASHCARD_CACHE_FILE, cache);

    res.json({ cards: shuffle(merged).slice(0, count), source: pool.length ? 'cache+ai' : 'ai' });
  } catch (err) {
    if (pool.length) {
      console.warn(`[flashcards] AI generation failed, serving ${pool.length} cached cards instead:`, err.message);
      return res.json({ cards: shuffle(pool).slice(0, count), source: 'cache-partial' });
    }
    console.error('Flashcard error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// One-page study notes for an entire section — one entry per objective,
// generated together (not per-objective Explain calls) so the notes read as
// one coherent document instead of N separate disconnected explanations.
const NOTES_CACHE_FILE = 'notes.live.json';
// Notes are a static reference document for a fixed set of objectives, so
// (unlike quiz/flashcard pools) there's no benefit to variety — the same
// section should always show the same notes. Cache key is the exact
// objectives list, so a different set of objectives (e.g. outline edits)
// naturally misses and regenerates rather than serving stale content.
function notesCacheKey(objectives) { return objectives.join('|'); }

app.post('/api/notes', async (req, res) => {
  const { org, event, objective, objectives } = req.body;
  if (!isSafeSlug(org) || !isSafeSlug(event)) return res.status(400).json({ error: 'Invalid org or event' });
  if (!Array.isArray(objectives) || objectives.length === 0) return res.status(400).json({ error: 'No objectives provided' });

  const cache = loadLiveCache(org, event, NOTES_CACHE_FILE);
  const key = notesCacheKey(objectives);
  if (cache[key]) {
    return res.json({ notes: cache[key], source: 'cache' });
  }

  const outline = extractRelevantSection(getOutline(org, event), objective);
  const extras  = getExtras(org, event);
  const prompt  = buildGenPrompt('notes', objectives.length, objective, outline, '', extras, event, [], objectives);

  try {
    const parsed = await withRetry(async () => {
      let raw = '';
      if (PROVIDER === 'anthropic') raw = await callAnthropic(prompt);
      else if (PROVIDER === 'gemini') raw = await callGemini(prompt, { maxOutputTokens: Math.min(objectives.length * 300, 8192) });
      else raw = await callOllamaStreaming([{ role: 'user', content: prompt }], OLLAMA_GEN_OPTS);
      return extractJSON(raw);
    });
    const notes = normalizeNotes(parsed, objectives);
    if (notes.length === 0) throw new Error('Model returned no usable notes');
    cache[key] = notes;
    saveLiveCache(org, event, NOTES_CACHE_FILE, cache);
    res.json({ notes, source: 'ai' });
  } catch (err) {
    console.error('Notes error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Presentation Workbot — one console where a student picks an FBLA
// presentation event, supplies whatever inputs they have (a pasted script or
// an uploaded document/deck), and gets back one merged scorecard covering
// the event's full official rating sheet. See services/presentationOrchestrator.js,
// services/scriptGrader.js, and SHARED-CONTRACT.md for the full spec.
const MAX_SCRIPT_LENGTH = 20000; // ~3500-4000 words — generous for a 5-7 min speech/report
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — generous for a document/deck upload
const workbotUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

app.get('/api/presentation-events', (req, res) => {
  // input_options is the ordered, per-event set of submission methods (from
  // presentation_tab_config.json) the picker offers — which one is primary
  // vs. an alternative genuinely varies per event (e.g. Business Plan wants
  // an uploaded report first; Public Speaking wants a pasted script first).
  res.json(listPresentationEvents().map(e => ({ ...e, input_options: inputOptionsFor(e.event) })));
});

// Accepts either a plain JSON body ({ eventId, inputs: { script } }) or a
// multipart/form-data submission (eventId field + an uploaded `file` field).
// A companion `inputType` field ("files" | "audio") says which grader the
// upload is for, since one uploaded buffer is ambiguous otherwise — defaults
// to "files" (document/deck) when omitted. Multer only intercepts multipart
// requests — a JSON POST passes through untouched to express.json()'s
// already-parsed req.body.
app.post('/api/workbot/grade', workbotUpload.single('file'), async (req, res) => {
  const eventId = req.body?.eventId;
  if (typeof eventId !== 'string' || !listPresentationEvents().some(e => e.event === eventId)) {
    return res.status(400).json({ error: 'Unknown or missing eventId' });
  }

  const inputs = {};

  let rawInputs = req.body?.inputs;
  if (typeof rawInputs === 'string') {
    try { rawInputs = JSON.parse(rawInputs); } catch { rawInputs = null; }
  }
  if (rawInputs && typeof rawInputs === 'object') {
    if (typeof rawInputs.script === 'string') inputs.script = rawInputs.script;
  }

  if (req.file) {
    if (req.body?.inputType === 'audio') {
      inputs.audio = { audioBuffer: req.file.buffer, filename: req.file.originalname, mimeType: req.file.mimetype };
    } else {
      inputs.files = { buffer: req.file.buffer, filename: req.file.originalname };
    }
  }

  if (inputs.script != null && inputs.script.length > MAX_SCRIPT_LENGTH) {
    return res.status(400).json({ error: `inputs.script exceeds ${MAX_SCRIPT_LENGTH} characters` });
  }

  console.log(`[workbot] event="${eventId}" inputs=${Object.keys(inputs).join(',')}`);
  try {
    const result = await runWorkbot(eventId, inputs);
    res.json(result);
  } catch (err) {
    console.error('Workbot error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Chat / Explain — SSE streaming
app.post('/api/chat', async (req, res) => {
  const { messages, org, event, objective, mode } = req.body;
  if (!isSafeSlug(org) || !isSafeSlug(event)) return res.status(400).json({ error: 'Invalid org or event' });
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.socket?.setNoDelay?.(true);

  try {
    const systemPrompt = buildSystemPrompt(org, event, objective, mode);
    if (PROVIDER === 'anthropic') await streamAnthropic(systemPrompt, messages, res);
    else if (PROVIDER === 'gemini') await streamGemini(systemPrompt, messages, res);
    else await streamOllama(systemPrompt, messages, res);
  } catch (err) {
    console.error(err);
    // A distinct `error` field, never `text` — the raw SDK error (often
    // literal JSON like {"type":"error","error":{"type":"overloaded_error",
    // ...}}) used to get written straight into `text`, so the frontend
    // rendered it as if it were the assistant's own reply instead of routing
    // it to the actual error banner/retry UI.
    const overloaded = err?.error?.error?.type === 'overloaded_error' || /overloaded/i.test(err?.message || '');
    const friendly = overloaded
      ? 'The AI service is temporarily overloaded — please try again in a moment.'
      : 'Something went wrong generating a response. Please try again.';
    res.write(`data: ${JSON.stringify({ error: friendly })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
});

// Live coverage dashboard — scans study-materials/ fresh on every request, so
// it always reflects whatever's on disk right now (no caching, no build step).
// Column pairs are NOT a min-count threshold on the single generated bank —
// the lower option in each pair (25/10/5) only reads a SEPARATELY-generated,
// non-overlapping bank file, which the pipeline doesn't produce yet. Until
// generate_bank.py grows that second batch, those three columns stay red for
// every event by construction — this just reports what actually exists.
const COVERAGE_TIERS = [
  { key: 'obj5',  label: 'Objective — 5',  kind: 'dedicated', filename: 'question-bank-objectives-5.json',  grouped: true,  min: 5  },
  { key: 'obj10', label: 'Objective — 10', kind: 'threshold', filename: 'question-bank-objectives.json',    grouped: true,  min: 10 },
  { key: 'sub10', label: 'Sub-topic — 10', kind: 'dedicated', filename: 'question-bank-sections-10.json',   grouped: true,  min: 10 },
  { key: 'sub20', label: 'Sub-topic — 20', kind: 'threshold', filename: 'question-bank-sections.json',      grouped: true,  min: 20 },
  { key: 'ov25',  label: 'Overall — 25',   kind: 'dedicated', filename: 'question-bank-25.json',            grouped: false, min: 25 },
  { key: 'ov50',  label: 'Overall — 50',   kind: 'threshold', filename: 'question-bank.json',                grouped: false, min: 50 },
];

// Counts knowledge areas ("A. Section Name (N items)") and numbered
// objectives underneath them straight from the source outline — this is the
// true target denominator, independent of whether generation has even
// started, so a 0%-generated event still shows a real percentage (of 0/N)
// rather than an undefined one.
function parseOutlineCounts(outlineText) {
  const marker = outlineText.indexOf('KNOWLEDGE AREAS AND OBJECTIVES');
  const body = marker >= 0 ? outlineText.slice(marker) : outlineText;
  const nSections   = (body.match(/^[A-Z]\.\s+.+$/gm) || []).length;
  const nObjectives = (body.match(/^\d+\.\s+.+$/gm) || []).length;
  return { nSections, nObjectives };
}

function scanCoverage() {
  const orgs = fs.readdirSync(MATERIALS_DIR)
    .filter(f => fs.statSync(path.join(MATERIALS_DIR, f)).isDirectory())
    .sort();
  const rows = [];
  for (const org of orgs) {
    const orgDir = path.join(MATERIALS_DIR, org);
    const events = fs.readdirSync(orgDir)
      .filter(f => fs.statSync(path.join(orgDir, f)).isDirectory())
      .sort();
    for (const event of events) {
      const evDir = path.join(orgDir, event);
      const row = { org, event, cells: {} };
      let evTotal = 0, secData = null, objData = null;
      for (const tier of COVERAGE_TIERS) {
        const p = path.join(evDir, tier.filename);
        let ok = false, detail = 'no bank';
        if (fs.existsSync(p)) {
          try {
            const data = JSON.parse(fs.readFileSync(p, 'utf8'));
            if (tier.grouped) {
              const counts = Object.values(data).map(v => v.length);
              const min = counts.length ? Math.min(...counts) : 0;
              ok = counts.length > 0 && min >= tier.min;
              detail = counts.length ? `min ${min}/group across ${counts.length} groups` : 'empty bank';
              if (tier.key === 'obj10') objData = data;
              if (tier.key === 'sub20') secData = data;
            } else {
              ok = Array.isArray(data) && data.length >= tier.min;
              detail = Array.isArray(data) ? `${data.length} total` : 'malformed bank';
              if (tier.key === 'ov50' && Array.isArray(data)) evTotal = data.length;
            }
          } catch {
            detail = 'unreadable bank';
          }
        }
        row.cells[tier.key] = { ok, detail };
      }

      // Percentage of the full generation target actually banked, using the
      // *current* tiers only (obj10/sub20/ov50 — SCOPE_BANK_MAX here,
      // TIER_TARGET in generate_bank.py, same values) since those are the
      // only ones the pipeline actually produces; the dedicated-bank tiers above have no
      // generation target to measure against yet. Each unit's contribution
      // is capped at its own target so over-generation can't push an event
      // above 100%.
      // A handful of events (e.g. "Introduction to FBLA") use a flatter
      // outline with no lettered sections at all, which the regex above
      // can't see — take whichever of outline-parsed or bank-derived is
      // larger so the denominator can never come in smaller than what's
      // actually been generated (which would push pct over 100%).
      const outlinePath = path.join(evDir, 'event-outline.txt');
      let nSections = secData ? Object.keys(secData).length : 0;
      let nObjectives = objData ? Object.keys(objData).length : 0;
      if (fs.existsSync(outlinePath)) {
        try {
          const counts = parseOutlineCounts(fs.readFileSync(outlinePath, 'utf8'));
          nSections   = Math.max(nSections, counts.nSections);
          nObjectives = Math.max(nObjectives, counts.nObjectives);
        } catch { /* fall back to bank-derived counts above */ }
      }
      const target = SCOPE_BANK_MAX.event + SCOPE_BANK_MAX.section * nSections + SCOPE_BANK_MAX.objective * nObjectives;
      const actualEvent = Math.min(evTotal, SCOPE_BANK_MAX.event);
      const actualSections = secData ? Object.values(secData).reduce((sum, v) => sum + Math.min(v.length, SCOPE_BANK_MAX.section), 0) : 0;
      const actualObjectives = objData ? Object.values(objData).reduce((sum, v) => sum + Math.min(v.length, SCOPE_BANK_MAX.objective), 0) : 0;
      const actual = actualEvent + actualSections + actualObjectives;
      row.pct = target > 0 ? Math.round((actual / target) * 100) : 0;
      row.pctDetail = `${actual}/${target} questions (${SCOPE_BANK_MAX.event} event + ${nSections}×${SCOPE_BANK_MAX.section} sub-topic + ${nObjectives}×${SCOPE_BANK_MAX.objective} objective)`;
      row.actual = actual;
      row.target = target;

      rows.push(row);
    }
  }
  return rows;
}

app.get('/admin/coverage', (req, res) => {
  const rows = scanCoverage();
  const orgLabel = { fbla: 'FBLA', deca: 'DECA', hosa: 'HOSA' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtName = slug => slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const totals = Object.fromEntries(COVERAGE_TIERS.map(t => [t.key, rows.filter(r => r.cells[t.key].ok).length]));
  const totalActual = rows.reduce((sum, r) => sum + r.actual, 0);
  const totalTarget = rows.reduce((sum, r) => sum + r.target, 0);
  const sitePct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  const summaryCards = COVERAGE_TIERS.map(t =>
    `<div class="stat"><div class="stat-num">${totals[t.key]}<span class="stat-den">/${rows.length}</span></div><div class="stat-label">${esc(t.label)}</div></div>`
  ).join('') + `<div class="stat stat-pct"><div class="stat-num">${sitePct}<span class="stat-den">%</span></div><div class="stat-label">Questions generated</div></div>`;

  const orgOrder = ['fbla', 'deca', 'hosa'];
  let bodyRows = '';
  for (const org of orgOrder) {
    const orgRows = rows.filter(r => r.org === org);
    if (!orgRows.length) continue;
    bodyRows += `<tr class="org-row"><td colspan="8">${esc(orgLabel[org] || org)} (${orgRows.length})</td></tr>`;
    for (const r of orgRows) {
      const tds = COVERAGE_TIERS.map(t => {
        const c = r.cells[t.key];
        const cls = c.ok ? 'good' : 'bad';
        const icon = c.ok ? '✓' : '✗';
        return `<td class="cell ${cls}" title="${esc(c.detail)}"><span class="dot">${icon}</span></td>`;
      }).join('');
      const pctCell = `<td class="cell pct-cell" title="${esc(r.pctDetail)}">
        <div class="pct-wrap"><div class="pct-bar"><div class="pct-fill" style="width:${r.pct}%"></div></div><span class="pct-text">${r.pct}%</span></div>
      </td>`;
      bodyRows += `<tr><td class="ev-name">${esc(fmtName(r.event))}</td>${tds}${pctCell}</tr>`;
    }
  }

  const headerCells = COVERAGE_TIERS.map(t => `<th>${esc(t.label)}</th>`).join('') + '<th>% Generated</th>';

  res.setHeader('Cache-Control', 'no-store');
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Question Bank Coverage — VyeAI Admin</title>
<meta name="robots" content="noindex, nofollow" />
<style>
  :root {
    color-scheme: light;
    --surface-1: #fcfcfb; --page: #f9f9f7; --text-primary: #0b0b0b; --text-secondary: #52514e;
    --text-muted: #898781; --gridline: #e1e0d9; --border: rgba(11,11,11,0.10);
    --good: #0ca30c; --good-bg: #e4f5e4; --critical: #d03b3b; --critical-bg: #fbe7e6;
    --seq: #2a78d6; --seq-track: #e1e0d9;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --surface-1: #1a1a19; --page: #0d0d0d; --text-primary: #ffffff; --text-secondary: #c3c2b7;
      --text-muted: #898781; --gridline: #2c2c2a; --border: rgba(255,255,255,0.10);
      --good: #0ca30c; --good-bg: #123a17; --critical: #e66767; --critical-bg: #3d1f1f;
      --seq: #3987e5; --seq-track: #2c2c2a;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--text-primary); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { padding: 32px 24px 64px; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
  .sub { color: var(--text-secondary); font-size: 13px; margin: 0 0 4px; }
  .refresh-note { color: var(--text-muted); font-size: 11px; margin: 0 0 24px; }
  .summary { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 28px; }
  .stat { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 12px 10px; text-align: center; }
  .stat-pct { border-color: var(--seq); }
  .stat-pct .stat-num { color: var(--seq); }
  .stat-num { font-size: 20px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .stat-den { font-size: 12px; font-weight: 500; color: var(--text-muted); }
  .stat-label { font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
  .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 10px; background: var(--surface-1); }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  thead th { position: sticky; top: 0; background: var(--surface-1); text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 11px; padding: 10px 6px; border-bottom: 1px solid var(--gridline); white-space: nowrap; }
  thead th:first-child { text-align: left; }
  .ev-name { padding: 7px 12px; white-space: nowrap; }
  td { border-bottom: 1px solid var(--gridline); }
  .org-row td { background: var(--page); color: var(--text-muted); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 8px 12px; }
  .cell { text-align: center; padding: 4px; }
  .dot { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 6px; font-size: 12px; font-weight: 700; }
  .cell.good .dot { background: var(--good-bg); color: var(--good); }
  .cell.bad .dot { background: var(--critical-bg); color: var(--critical); }
  .pct-cell { padding: 4px 12px; }
  .pct-wrap { display: flex; align-items: center; gap: 8px; }
  .pct-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--seq-track); overflow: hidden; min-width: 60px; }
  .pct-fill { height: 100%; background: var(--seq); border-radius: 3px; }
  .pct-text { font-size: 11px; color: var(--text-secondary); font-variant-numeric: tabular-nums; width: 32px; text-align: right; }
  tbody tr:hover td:not(.org-row td) { background: var(--gridline); }
  .legend { display: flex; gap: 18px; margin: 14px 0 0; font-size: 12px; color: var(--text-secondary); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
</style>
</head>
<body>
<main>
  <h1>Question Bank Coverage</h1>
  <p class="sub">Live scan of study-materials/ — ${rows.length} events across FBLA / DECA / HOSA. The lower option in each pair only counts a separately-generated, non-overlapping bank; it stays red until that second batch exists, even if the higher option is fully generated.</p>
  <p class="refresh-note">Reload this page any time — it re-scans disk on every request, never cached.</p>
  <div class="summary">${summaryCards}</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Event</th>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  <div class="legend">
    <span><span class="dot cell good" style="display:inline-flex;border-radius:4px;">✓</span> Bank exists &amp; meets threshold</span>
    <span><span class="dot cell bad" style="display:inline-flex;border-radius:4px;">✗</span> Not generated / below threshold</span>
  </div>
</main>
</body>
</html>`);
});

// In production, serve the Vite-built frontend and handle client-side routing
if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'dist');
  app.use(express.static(dist));
  // Plain middleware (no path pattern) rather than app.get('*', ...) — Express
  // 5's router (path-to-regexp v7+) rejects a bare "*" wildcard route pattern
  // at registration time ("Missing parameter name"). A path-less app.use()
  // catches everything that reached here without needing regex parsing at all.
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// ---------------------------------------------------------------------------
// Live-cache → GitHub sync. Render's disk for this service is wiped on every
// redeploy, so the *.live.json files the AI-generation cache writes (see
// loadLiveCache/saveLiveCache above) would otherwise vanish the next time
// this app is deployed. On an hourly timer, this commits and pushes just
// those cache files straight to `main` from the running server itself, so
// the accumulated cache survives redeploys the same way the real
// generate_bank.py-produced banks do.
//
// Opt-in via GITHUB_PUSH_TOKEN (a GitHub fine-grained PAT scoped to this one
// repo's Contents:Read-and-write permission) — with no token set, this is a
// silent no-op, so it's safe to run in local dev too. GITHUB_REPO defaults
// to this project's own repo.
// ---------------------------------------------------------------------------
const GITHUB_PUSH_TOKEN = process.env.GITHUB_PUSH_TOKEN || '';
const GITHUB_REPO = process.env.GITHUB_REPO || 'soorajtoor-a11y/studystock';
const CACHE_SYNC_INTERVAL_MS = 60 * 60 * 1000;

function findLiveCacheFiles() {
  const results = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.live.json')) results.push(full);
    }
  }
  if (fs.existsSync(MATERIALS_DIR)) walk(MATERIALS_DIR);
  return results;
}

let cacheSyncInFlight = false;
function syncLiveCacheToGitHub() {
  if (!GITHUB_PUSH_TOKEN || cacheSyncInFlight) return;
  cacheSyncInFlight = true;
  try {
    if (!fs.existsSync(path.join(REPO_ROOT, '.git'))) {
      console.warn('[cache-sync] no .git checkout in this environment — skipping (persistence needs a git-based deploy)');
      return;
    }
    const files = findLiveCacheFiles();
    if (!files.length) return;
    const relFiles = files.map(f => path.relative(REPO_ROOT, f));

    const git = (args) => execFileSync('git', args, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

    git(['add', '--', ...relFiles]);
    const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: REPO_ROOT }).toString().trim();
    if (!staged) return; // nothing new since the last sync

    git(['-c', 'user.name=Vye Cache Bot', '-c', 'user.email=cache-bot@usevye.study',
         'commit', '-m', 'Auto-update live generation cache']);
    const pushUrl = `https://x-access-token:${GITHUB_PUSH_TOKEN}@github.com/${GITHUB_REPO}.git`;
    git(['push', pushUrl, 'HEAD:main']);
    console.log(`[cache-sync] pushed ${relFiles.length} live-cache file(s) to GitHub`);
  } catch (err) {
    console.error('[cache-sync] failed:', err.message);
  } finally {
    cacheSyncInFlight = false;
  }
}

if (GITHUB_PUSH_TOKEN) {
  // One early run (a minute after boot) so a fresh deploy doesn't sit an
  // hour before its first sync, then hourly forever.
  setTimeout(syncLiveCacheToGitHub, 60 * 1000);
  setInterval(syncLiveCacheToGitHub, CACHE_SYNC_INTERVAL_MS);
}

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => console.log(`VyeAI — provider: ${PROVIDER} — port: ${PORT}`));
server.on('error', (err) => console.error('[server] listen error:', err));

// Guaranteed keep-alive: if the listen handle somehow isn't holding the event
// loop open in this environment, this timer will, so the process can't exit 0.
setInterval(() => {}, 1 << 30);

// Diagnostics — surface exactly how/if the process ever stops.
process.on('beforeExit', (code) => console.log('[server] beforeExit (event loop drained) code', code));
process.on('exit',        (code) => console.log('[server] exit code', code));
process.on('uncaughtException',  (err) => console.error('[server] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[server] unhandledRejection:', err));
