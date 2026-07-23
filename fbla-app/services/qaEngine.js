// Q&A Engine — BUILD-BRIEF-06-qa-engine.md. Generates judge-style Q&A
// questions grounded in a student's own submission (weighted toward their
// weakest graded criteria — free signal, the grader already found the thin
// spots), then scores their answers and unlocks the event's `qa` rubric
// criterion, which the Script/Audio graders always leave `locked`. v1
// supports exactly the "one qa criterion" shape (14 of 15 build-ready
// events) — Job Interview's 5-criterion qa sheet is a different modality
// and is excluded by the frontend's own length check, not here.

import { CACHE_SPLIT_MARKER, withRetry, callHaiku, extractJSON } from './llmClient.js';
import { deriveBand } from './bands.js';

const QUESTION_COUNT = 5;

// ---------------------------------------------------------------------------
// Question generation
// ---------------------------------------------------------------------------

// Difficulty ramps across the set rather than hitting hardest-first — a
// student's very first live answer shouldn't be to the toughest, most
// exposing question generated. Q1 is a deliberate warm-up (confidence-
// building, answerable straight from what they already wrote), the
// weakness-targeted callout is capped at exactly one (not "more if there are
// multiple weak criteria" — that was producing sets that were 3-4
// interrogation-style questions in a row) and is explicitly asked to sound
// like curious follow-up, not a "gotcha."
function buildQuestionPrompt(event, submissionText, weakCriteria, recentQuestions) {
  const weakLines = weakCriteria.length
    ? weakCriteria.map(c => `- "${c.criterion}" (scored ${c.points}/${c.max}, ${c.band}): ${c.justification}`).join('\n')
    : '(nothing scored notably low — use a second grounded-probe or judge-standard question instead of a weakness one)';

  const recentBlock = recentQuestions.length
    ? `\n\nDo NOT repeat or closely rephrase any of these questions already asked recently:\n${recentQuestions.map(q => `- ${q}`).join('\n')}`
    : '';

  return `You are a friendly but rigorous FBLA competitive-events judge about to ask ${event.event} Q&A questions after reading this student's submission. Judges want students to succeed — the goal is a fair, confidence-building conversation, not an interrogation.

EVENT: ${event.event}

Generate exactly ${QUESTION_COUNT} questions, one per slot below, difficulty ramping up gradually — do NOT front-load the hardest questions:

SLOT 1 — WARM-UP (easy, low-pressure): A friendly opener grounded in the core concept of their submission (their main idea, mission, or topic) — something they can answer confidently right away, in their own words. NOT a weakness callout, NOT a "gotcha," NOT about a number or a gap. Just an inviting "tell me more about..." on something they clearly already covered well.
SLOT 2 — GROUNDED PROBE (easy-to-moderate): Pull one specific claim, number, or statement from their submission and ask them to elaborate on it (e.g. "You mentioned X — walk me through how you got there?"). Curious in tone, not skeptical.
SLOT 3 — WEAKNESS-TARGETED (moderate; exactly one question of this type, never more): the single most useful follow-up a supportive judge would ask about this weak-scoring criterion, phrased as genuine curiosity rather than calling out what's missing (say "How are you thinking about X?" not "I don't see X anywhere"):
${weakLines}
SLOT 4 — JUDGE-STANDARD (moderate): feasibility, competition/market, or "what would you change" — personalized to their actual topic.
SLOT 5 — JUDGE-STANDARD (moderate-to-harder, since they're warmed up by now): risks, next steps, or a "what if" scenario — still fair, never a trick question.

Every question must be answerable by someone who actually read/wrote this submission — reference their specifics, not generic textbook topics.${recentBlock}

Return a JSON array of exactly ${QUESTION_COUNT} objects, in slot order: [{"text": "<the question>", "type": "warmup"|"probe"|"weakness"|"standard", "targets_criterion": "<exact criterion name from the weak list above, or null>"}]. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase inside "text", never double quotes.

${CACHE_SPLIT_MARKER}
STUDENT SUBMISSION:
"""
${submissionText}
"""`;
}

// Picks the 2-3 lowest-scoring SCORED criteria (never locked ones — nothing
// to target there) to ground weakness-targeted questions in.
function pickWeakCriteria(gradedCriteria) {
  return gradedCriteria
    .filter(c => c.status === 'scored' && c.max > 0)
    .map(c => ({ ...c, ratio: c.points / c.max }))
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 3);
}

export async function generateQuestions(event, submissionText, gradedCriteria, recentQuestions = []) {
  const weakCriteria = pickWeakCriteria(gradedCriteria);
  const parsed = await withRetry(async () =>
    extractJSON(await callHaiku(buildQuestionPrompt(event, submissionText, weakCriteria, recentQuestions)))
  , 3, 'Q&A question generator');

  return parsed.slice(0, QUESTION_COUNT).map((q, i) => ({
    id: `q${i + 1}`,
    text: String(q?.text || '').trim() || `Question ${i + 1}`,
    type: ['warmup', 'probe', 'weakness', 'standard'].includes(q?.type) ? q.type : 'standard',
    targets_criterion: q?.targets_criterion || null,
  }));
}

// ---------------------------------------------------------------------------
// Answer scoring
// ---------------------------------------------------------------------------

function buildAnswerScoringPrompt(event, qaCriterion, submissionText, exchanges) {
  const exchangeLines = exchanges.map((ex, i) =>
    `${i + 1}. Q: "${ex.question}"\n   A (${ex.isAudio ? 'spoken, transcribed' : 'written'}): "${ex.answer}"`
  ).join('\n\n');

  return `You are an FBLA competitive-events judge scoring a student's live Q&A answers after their ${event.event} presentation.

Score EACH exchange independently on a 0-${qaCriterion.max} scale, based on:
- Does the answer actually ADDRESS the question asked (a dodge or non-answer scores low)?
- Is it ACCURATE and consistent with their original submission (quoted below)?
- Is it CLEAR and well-structured?
${exchanges.some(e => e.isAudio) ? '- For spoken (transcribed) answers only: does it read as composed and confident rather than rambling or filler-heavy?' : ''}

Be a maximally consistent, reproducible judge: the same answer scored again should land on the same number.

EXCHANGES:
${exchangeLines}

Return a JSON array of exactly ${exchanges.length} objects, one per exchange in order: [{"points": <integer, 0 to ${qaCriterion.max}>, "feedback": "<1-2 sentences on what was strong or missing>"}]. Output ONLY the JSON array — no markdown fences, no text outside it. Use single quotes for any quoted phrase, never double quotes.

${CACHE_SPLIT_MARKER}
ORIGINAL SUBMISSION (for consistency-checking their answers):
"""
${submissionText}
"""`;
}

// Scores every exchange independently, then averages — a fundamentally
// different (and sound) aggregation from the mechanical sub-score
// decomposition tried earlier for the main content grader and reverted: that
// was ONE criterion split into 3 correlated judgments about the SAME text,
// which compounded variance instead of reducing it. This is N independent
// judgments about N different exchanges, then averaged — the standard,
// well-established way multi-question assessments are scored.
// Pure, network-free — turns raw per-exchange scores into the final
// {criterion, band, points, justification, fix, per_question} shape. Split
// out from scoreAnswers() below so the averaging/rounding/band-derivation
// arithmetic is unit-testable without needing a real model response.
function aggregateAnswerScores(qaCriterion, exchanges, rawScores) {
  const perQuestion = exchanges.map((ex, i) => {
    const s = rawScores[i] || {};
    const points = Math.max(0, Math.min(qaCriterion.max, Math.round(Number(s.points) || 0)));
    return {
      question: ex.question,
      answer: ex.answer,
      points,
      feedback: String(s.feedback || '').trim() || 'No feedback returned.',
    };
  });

  const avgPoints = perQuestion.reduce((sum, q) => sum + q.points, 0) / perQuestion.length;
  const { points, band } = deriveBand(avgPoints, qaCriterion.max, qaCriterion.criterion);

  const strongest = [...perQuestion].sort((a, b) => b.points - a.points)[0];
  const weakest = [...perQuestion].sort((a, b) => a.points - b.points)[0];

  return {
    criterion: qaCriterion.criterion,
    sheet: qaCriterion.sheet,
    max: qaCriterion.max,
    band,
    points,
    justification: `Averaged across ${perQuestion.length} Q&A exchanges. Strongest: "${strongest.question}" (${strongest.points}/${qaCriterion.max}). Weakest: "${weakest.question}" (${weakest.points}/${qaCriterion.max}).`,
    fix: weakest.feedback,
    per_question: perQuestion,
  };
}

export async function scoreAnswers(event, qaCriterion, submissionText, exchanges) {
  if (exchanges.length === 0) {
    return {
      criterion: qaCriterion.criterion, sheet: qaCriterion.sheet, max: qaCriterion.max,
      band: 'Not Demonstrated', points: 0,
      justification: 'No Q&A answers were submitted.', fix: 'Answer the Q&A questions to earn these points.',
      per_question: [],
    };
  }

  const scores = await withRetry(async () =>
    extractJSON(await callHaiku(buildAnswerScoringPrompt(event, qaCriterion, submissionText, exchanges)))
  , 3, 'Q&A answer scorer');

  return aggregateAnswerScores(qaCriterion, exchanges, scores);
}

// Exported for tests only.
export const _internal = { pickWeakCriteria, aggregateAnswerScores };
