// Shared scoring-band logic — SHARED-CONTRACT.md calls for exactly one place
// that owns bandsFor(max); every grader (Script, Audio, future Downloader)
// imports from here instead of keeping its own copy.

// Band ranges — table from the brief. Each max maps to [below, meets, exceeds]
// inclusive ranges; 0 is always "Not Demonstrated" and isn't listed.
const BAND_TABLE = {
  20: { below: [1, 9], meets: [10, 16], exceeds: [17, 20] },
  15: { below: [1, 8], meets: [9, 12], exceeds: [13, 15] },
  10: { below: [1, 6], meets: [7, 8], exceeds: [9, 10] },
  8: { below: [1, 3], meets: [4, 6], exceeds: [7, 8] },
  5: { below: [1, 2], meets: [3, 4], exceeds: [5, 5] },
  4: { below: [1, 1], meets: [2, 3], exceeds: [4, 4] },
};

export function getBandRanges(max) {
  const table = BAND_TABLE[max];
  if (!table) throw new Error(`No band table defined for max=${max}`);
  return table;
}

// Only a criterion literally named this is binary — per the brief, this
// exact-name check must NOT catch similarly-named criteria like "Protocol
// Adherence" (Data Analysis), which are banded normally.
export function isBinaryCriterion(criterionName) {
  return criterionName === 'Adherence to Guidelines';
}

// Derives the correct band + clamped points from raw model output. This is
// the single place band labels are decided — the model's own band opinion
// (if any) is discarded, for every grader.
export function deriveBand(rawPoints, max, criterionName) {
  const clamped = Math.max(0, Math.min(max, Math.round(Number(rawPoints) || 0)));

  if (isBinaryCriterion(criterionName)) {
    return clamped >= max
      ? { points: max, band: 'Meets Expectations' }
      : { points: 0, band: 'Not Demonstrated' };
  }

  if (clamped === 0) return { points: 0, band: 'Not Demonstrated' };
  const { below, meets } = getBandRanges(max);
  if (clamped <= below[1]) return { points: clamped, band: 'Below Expectations' };
  if (clamped <= meets[1]) return { points: clamped, band: 'Meets Expectations' };
  return { points: clamped, band: 'Exceeds Expectations' };
}

// Formats the band ranges for a criterion into the prompt line every grader
// shows the model, so a student sees identically-worded bands regardless of
// which tool scored a given line.
export function bandLineForPrompt(criterion) {
  if (isBinaryCriterion(criterion.criterion)) {
    return `Bands: BINARY — award exactly 0 or exactly ${criterion.max}, no partial credit.`;
  }
  const { below, meets, exceeds } = getBandRanges(criterion.max);
  return `Bands: Not Demonstrated 0 | Below Expectations ${below[0]}-${below[1]} | ` +
    `Meets Expectations ${meets[0]}-${meets[1]} | Exceeds Expectations ${exceeds[0]}-${exceeds[1]}`;
}
