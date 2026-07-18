// Downloader — file/artifact grader, v1: documents + slide decks only. See
// BUILD-BRIEF-04-downloader.md + SHARED-CONTRACT.md.
//
// This is a router by file type, not its own AI: PDF/DOCX/PPTX all resolve
// to plain text, which is then handed to the Script grader — no duplicate
// grading logic here. Everything else (video, images, code, URLs) is an
// explicit stub that returns an empty result and a note, never a fabricated
// score, per BUILD-BRIEF-04's own table.

import { findEvent, allCriteria } from './rubrics.js';
import { grade as gradeScript } from './scriptGrader.js';
import { isBinaryCriterion } from './bands.js';

export function extFromFilename(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  return m ? m[1].toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Extraction — one function per supported format. Each returns plain text
// (+ whatever structural info its format-specific checks need).
// ---------------------------------------------------------------------------
async function extractPdfText(buffer) {
  const { default: pdfParse } = await import('pdf-parse');
  const data = await pdfParse(buffer);
  return { text: data.text, pageCount: data.numpages };
}

async function extractDocxText(buffer) {
  const { default: mammoth } = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  // DOCX has no reliable page count from text extraction alone (pagination
  // depends on rendering) — page-limit checks only apply to PDF uploads.
  return { text: result.value, pageCount: null };
}

async function extractPptxSlides(buffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);

  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return na - nb;
    });

  const slides = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async('string');
    const textRuns = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => m[1]);
    slides.push(textRuns.join(' '));
  }

  const imageCount = Object.keys(zip.files).filter(name => /^ppt\/media\//.test(name)).length;
  return { slides, slideCount: slides.length, imageCount };
}

// ---------------------------------------------------------------------------
// File-only checks — things the Script grader can't do from text alone.
// Best-effort: only asserts a check when the rubric actually declares the
// relevant field, since real event data uses inconsistent key names
// (Business Plan: required_sections; Business Ethics: required_report_headings;
// Job Interview: resume_page_limit/cover_letter_page_limit, no plain page_limit).
// ---------------------------------------------------------------------------
export function resolvePageLimit(deliverable) {
  return deliverable?.page_limit ?? deliverable?.resume_page_limit ?? deliverable?.cover_letter_page_limit ?? null;
}

export function resolveRequiredSections(deliverable) {
  return deliverable?.required_sections || deliverable?.required_report_headings || null;
}

export function findMissingSections(text, requiredSections) {
  if (!requiredSections || requiredSections.length === 0) return [];
  const lower = text.toLowerCase();
  return requiredSections.filter(section => !lower.includes(section.toLowerCase()));
}

export function findProhibitedItems(text, prohibited) {
  if (!prohibited || prohibited.length === 0) return [];
  const found = [];
  if (prohibited.some(p => /link/i.test(p)) && /https?:\/\/|www\./i.test(text)) {
    found.push('links');
  }
  if (prohibited.some(p => /qr/i.test(p)) && /qr code/i.test(text)) {
    found.push("'QR code' mentioned in text (an actual visual QR code can't be detected from extracted text)");
  }
  return found;
}

// Per the brief's explicit acceptance test: "A résumé over 2 pages caps the
// Job Interview format/adherence line." Caps the binary "Adherence to
// Guidelines"-style criterion to 0 when a hard page-limit violation is
// found — never silently ignored.
export function applyFileChecksToResults(results, gradableCriteria, fileChecks) {
  if (!fileChecks.overLimit) return results;
  const adherenceCriterion = gradableCriteria.find(c => isBinaryCriterion(c.criterion));
  if (!adherenceCriterion) return results;
  return results.map(r => {
    if (r.criterion !== adherenceCriterion.criterion || r.sheet !== adherenceCriterion.sheet) return r;
    return {
      ...r,
      points: 0,
      band: 'Not Demonstrated',
      justification: `The submission is ${fileChecks.pageCount} pages, exceeding this event's ${fileChecks.pageLimit}-page limit.`,
      fix: `Cut the submission down to ${fileChecks.pageLimit} pages or fewer, then resubmit.`,
    };
  });
}

async function gradeDocument(event, gradableCriteria, text, pageCount) {
  const deliverable = event.deliverable || {};
  const pageLimit = resolvePageLimit(deliverable);
  const missingSections = findMissingSections(text, resolveRequiredSections(deliverable));
  const prohibitedFound = findProhibitedItems(text, deliverable.prohibited);
  const overLimit = pageLimit != null && pageCount != null && pageCount > pageLimit;

  const scriptResult = await gradeScript(event.event, { scriptText: text });
  const results = applyFileChecksToResults(scriptResult.results, gradableCriteria, { overLimit, pageCount, pageLimit });

  return {
    toolId: 'downloader',
    results,
    meta: { extractedText: text, fileChecks: { pageCount, pageLimit, overLimit, missingSections, prohibitedFound } },
  };
}

async function gradeDeck(event, text, slideCount, imageCount) {
  const hasSourcesSlide = /sources|references|works cited|bibliography/i.test(text);
  const scriptResult = await gradeScript(event.event, { scriptText: text });
  return {
    toolId: 'downloader',
    results: scriptResult.results,
    meta: { extractedText: text, deck: { slideCount, imageCount, hasSourcesSlide } },
  };
}

const UNSUPPORTED_LABEL = { mp4: 'Video', mov: 'Video', webm: 'Video', png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', zip: 'Code repo' };

function unsupportedResult(ext) {
  const label = UNSUPPORTED_LABEL[ext] || 'This file type';
  return {
    toolId: 'downloader',
    results: [],
    meta: { note: `${label} isn't supported in the basic version yet — file handlers beyond documents and slide decks are a later phase.` },
  };
}

// ---------------------------------------------------------------------------
// Public entry point — SHARED-CONTRACT.md grade(eventId, input). `input`:
// { buffer, filename, kind? } — kind is an optional 'document' | 'deck' hint
// for a .pdf that's actually a slide export (PDF alone can't tell the two
// apart); everything else is inferred from the file extension.
// ---------------------------------------------------------------------------
export async function grade(eventId, input) {
  const event = findEvent(eventId);
  const gradable = allCriteria(event).filter(c => c.ai_gradable);
  const { buffer, filename, kind } = input;
  const ext = extFromFilename(filename);

  if (ext === 'docx') {
    const { text } = await extractDocxText(buffer);
    return gradeDocument(event, gradable, text, null);
  }

  if (ext === 'pptx') {
    const deck = await extractPptxSlides(buffer);
    return gradeDeck(event, deck.slides.join('\n\n'), deck.slideCount, deck.imageCount);
  }

  if (ext === 'pdf') {
    const { text, pageCount } = await extractPdfText(buffer);
    return kind === 'deck'
      ? gradeDeck(event, text, pageCount, null)
      : gradeDocument(event, gradable, text, pageCount);
  }

  return unsupportedResult(ext);
}

// Exported for tests only — not part of the public grading API.
export const _internal = {
  findMissingSections, findProhibitedItems, resolvePageLimit, resolveRequiredSections,
  applyFileChecksToResults, unsupportedResult,
};
