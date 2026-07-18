// Live end-to-end proof for the Downloader's document path — makes a real
// Haiku call. Hand-builds a minimal but genuinely valid .docx in memory (a
// DOCX is just a zip of a few small XML parts) so this exercises the real
// mammoth extraction step, not a mocked one, then feeds the extracted text
// through the same Script grader the Script tool itself uses.
//
// Run: node services/__tests__/downloaderLive.mjs

import assert from 'assert';
import JSZip from 'jszip';
import { grade } from '../downloader.js';

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function paragraphXml(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<w:p><w:r><w:t xml:space="preserve">${escaped}</w:t></w:r></w:p>`;
}

async function buildMinimalDocx(paragraphs) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels').file('.rels', RELS_XML);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map(paragraphXml).join('\n    ')}
  </w:body>
</w:document>`;
  zip.folder('word').file('document.xml', documentXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function main() {
  // Future Business Educator: page_limit 3, prohibited: ["links","QR codes"]
  // — a real report deliberately containing a link, to prove prohibited-item
  // detection fires on genuinely-extracted text, not a mocked string.
  const buffer = await buildMinimalDocx([
    'Overcoming Math Anxiety: A Lesson Plan for 9th Grade Algebra',
    'This lesson plan targets 9th grade students who experience math anxiety during timed assessments.',
    'Learning objectives: students will identify anxiety triggers and apply two coping strategies during a practice quiz.',
    'The lesson opens with a five-minute breathing exercise, followed by a low-stakes warm-up problem set.',
    'Students then work in pairs on scaffolded algebra problems, building confidence before the graded portion.',
    'Assessment: a short exit ticket measures both content mastery and self-reported anxiety level.',
    'For supplementary material, see https://example.edu/math-anxiety-resources.',
  ]);

  const result = await grade('Future Business Educator', { buffer, filename: 'lesson-plan.docx' });

  console.log(JSON.stringify({ toolId: result.toolId, resultCount: result.results.length, meta: result.meta }, null, 2));

  assert.strictEqual(result.toolId, 'downloader');
  assert.ok(result.results.length > 0, 'expected scored results from the extracted text');
  assert.ok(result.meta.extractedText.includes('Overcoming Math Anxiety'), 'extracted text should contain the real doc content');
  assert.deepStrictEqual(result.meta.fileChecks.prohibitedFound, ['links'], 'the link in the doc should be detected as prohibited');
  // DOCX has no reliable page count — page-limit checks only run on PDF uploads.
  assert.strictEqual(result.meta.fileChecks.pageCount, null);
  assert.strictEqual(result.meta.fileChecks.overLimit, false);

  for (const r of result.results) {
    assert.ok(r.points >= 0 && r.points <= r.max, `${r.criterion}: points out of range`);
    assert.ok(r.justification && r.justification.length > 0, `${r.criterion}: empty justification`);
  }

  console.log('\nAll mechanical invariants hold — real .docx extracted via mammoth, graded via the Script grader, prohibited link detected.');
}

main().catch(err => {
  console.error('DOWNLOADER LIVE TEST FAILED:', err);
  process.exit(1);
});
