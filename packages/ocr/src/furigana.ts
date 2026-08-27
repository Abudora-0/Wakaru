/**
 * Furigana removal.
 *
 * Furigana is the small reading gloss printed beside a kanji column in
 * vertical Japanese text: a narrow column of hiragana running immediately
 * against the character it annotates. Tesseract has no notion that it is
 * looking at two different things, so it reads the gloss as more body text
 * and interleaves it into whatever comes out. Measured against a real manga
 * page, this is the single biggest source of garbage in this project's
 * Japanese output, ahead of anything to do with resolution or contrast.
 *
 * Japanese body type sets every character, kana or kanji, into the same
 * square cell, so a genuine text column has one fixed width for its entire
 * length. Furigana is set at a smaller point size to fit into the gap beside
 * that column, so its column is reliably narrower everywhere it appears, and
 * it always sits touching the column it glosses. That is enough to find and
 * remove it without reading a single character, purely from the geometry of
 * a column density profile.
 *
 * This only addresses the vertical layout used throughout manga. Horizontal
 * ruby, set above a line rather than beside a column, is a different shape
 * and is not handled here.
 */

export interface ColumnBand {
  /** Pixel x where the band starts, inclusive. */
  start: number;
  /** Pixel x where the band ends, exclusive. */
  end: number;
  width: number;
  /** Ink pixels in the band divided by its area, 0 to 1. */
  density: number;
}

export interface FuriganaResult {
  /** The mask with furigana columns blanked to background. */
  mask: Uint8Array;
  /** Bands judged to be furigana and removed. */
  removed: ColumnBand[];
  /** Every band that was found, removed or not, for diagnostics. */
  columns: ColumnBand[];
}

export interface FuriganaOptions {
  /** A run of empty columns at least this wide splits one band from the next. */
  minGap?: number;
  /** A column needs at least this fraction of its height in ink to count as text. */
  minDensity?: number;
  /** A band narrower than this fraction of the main column width is a gloss. */
  narrowRatio?: number;
  /** How many empty pixels may separate a gloss from the column it glosses. */
  adjacencyGap?: number;
}

const DEFAULTS: Required<FuriganaOptions> = {
  minGap: 2,
  minDensity: 0.02,
  narrowRatio: 0.62,
  adjacencyGap: 4,
};

/** Ink pixels per column, x = 0 to width - 1. Mask convention: 1 is ink, 0 is background. */
function columnProfile(mask: Uint8Array, width: number, height: number): Uint32Array {
  const profile = new Uint32Array(width);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x] === 1) profile[x] = (profile[x] ?? 0) + 1;
    }
  }
  return profile;
}

/**
 * Group a column profile into bands of ink separated by gaps.
 *
 * Each band is a candidate text column: in a vertical text region, one
 * column is one line of text, or one line's furigana running beside it.
 */
export function findColumnBands(
  mask: Uint8Array,
  width: number,
  height: number,
  options: FuriganaOptions = {},
): ColumnBand[] {
  const settings = { ...DEFAULTS, ...options };
  const profile = columnProfile(mask, width, height);
  const minInk = Math.max(1, Math.round(height * settings.minDensity));

  const bands: ColumnBand[] = [];
  let start = -1;
  let gap = 0;

  for (let x = 0; x <= width; x++) {
    const ink = x < width ? (profile[x] ?? 0) : 0;
    const hasInk = ink >= minInk;

    if (hasInk) {
      if (start === -1) start = x;
      gap = 0;
      continue;
    }

    if (start === -1) continue;

    gap++;
    if (gap < settings.minGap && x < width) continue;

    const end = x - gap + 1;
    if (end > start) {
      let sum = 0;
      for (let i = start; i < end; i++) sum += profile[i] ?? 0;
      bands.push({ start, end, width: end - start, density: sum / ((end - start) * height) });
    }
    start = -1;
    gap = 0;
  }

  return bands;
}

/**
 * Remove furigana columns from a text mask.
 *
 * Requires at least two bands: a lone column of text is never furigana
 * against nothing, and treating it as such would erase real text on any
 * bubble that happens to hold a single narrow line.
 */
export function stripFurigana(
  mask: Uint8Array,
  width: number,
  height: number,
  options: FuriganaOptions = {},
): FuriganaResult {
  const settings = { ...DEFAULTS, ...options };
  const columns = findColumnBands(mask, width, height, settings);

  if (columns.length < 2) {
    return { mask, removed: [], columns };
  }

  const widest = Math.max(...columns.map((band) => band.width));
  const mainCandidates = columns.filter((band) => band.width >= widest * 0.7);
  const mainWidths = mainCandidates.map((band) => band.width).sort((a, b) => a - b);
  const mainWidth = mainWidths[Math.floor(mainWidths.length / 2)] ?? widest;

  const removed: ColumnBand[] = [];

  for (const band of columns) {
    if (mainCandidates.includes(band)) continue;
    if (band.width >= mainWidth * settings.narrowRatio) continue;

    // A gloss always sits touching the column it annotates. A narrow column
    // with no wide neighbour nearby is more likely a stray mark or the tail
    // of punctuation than a reading gloss, so it is left alone.
    const touchesMainColumn = mainCandidates.some((main) => {
      const gapBefore = band.start - main.end;
      const gapAfter = main.start - band.end;
      return (gapBefore >= 0 && gapBefore <= settings.adjacencyGap) || (gapAfter >= 0 && gapAfter <= settings.adjacencyGap);
    });

    if (touchesMainColumn) removed.push(band);
  }

  if (removed.length === 0) {
    return { mask, removed: [], columns };
  }

  const cleaned = Uint8Array.from(mask);
  for (const band of removed) {
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = band.start; x < band.end; x++) cleaned[row + x] = 0;
    }
  }

  return { mask: cleaned, removed, columns };
}
