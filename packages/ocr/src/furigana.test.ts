import { describe, expect, it } from "vitest";
import { findColumnBands, stripFurigana } from "./furigana";

/**
 * Every fixture here is a hand drawn mask rather than a real scanned bubble,
 * because the geometry this module relies on, a wide column running beside a
 * narrow one, is exactly what needs to be pinned down independently of
 * Tesseract or any real page. If the geometry is right the real pages take
 * care of themselves; if it is wrong no amount of tuning against a real page
 * would have shown it clearly.
 */

const HEIGHT = 60;

/** Build a mask of the given width with ink filling the named column ranges. */
function maskWithColumns(width: number, columns: Array<[number, number]>): Uint8Array {
  const mask = new Uint8Array(width * HEIGHT);
  for (const [start, end] of columns) {
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = start; x < end; x++) mask[y * width + x] = 1;
    }
  }
  return mask;
}

describe("findColumnBands", () => {
  it("finds a single column as one band", () => {
    const mask = maskWithColumns(20, [[4, 14]]);
    const bands = findColumnBands(mask, 20, HEIGHT);

    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({ start: 4, end: 14, width: 10 });
  });

  it("separates two columns divided by a gap", () => {
    const mask = maskWithColumns(30, [
      [2, 12],
      [16, 26],
    ]);
    const bands = findColumnBands(mask, 30, HEIGHT);

    expect(bands).toHaveLength(2);
    expect(bands[0]!.width).toBe(10);
    expect(bands[1]!.width).toBe(10);
  });

  it("does not split a column over a gap narrower than minGap", () => {
    // A one pixel antialiasing seam inside a real character must not read as
    // two separate columns.
    const mask = maskWithColumns(20, [
      [2, 9],
      [10, 17],
    ]);
    const bands = findColumnBands(mask, 20, HEIGHT, { minGap: 2 });

    expect(bands).toHaveLength(1);
  });

  it("ignores a column with too little ink to count as text", () => {
    // Two stray pixels in a hundred row mask sit under a 2 percent density
    // floor, well below the ordinary case of a solid printed column.
    // height 100 at the default 2 percent floor requires 2 ink pixels in a
    // column to count; a single stray pixel must fall short of that.
    const tallHeight = 100;
    const mask = new Uint8Array(20 * tallHeight);
    mask[5 * 20 + 10] = 1;

    expect(findColumnBands(mask, 20, tallHeight)).toHaveLength(0);
  });

  it("finds nothing on a blank mask", () => {
    expect(findColumnBands(new Uint8Array(20 * HEIGHT), 20, HEIGHT)).toHaveLength(0);
  });
});

describe("stripFurigana", () => {
  it("removes a narrow column touching a wide one", () => {
    // A kanji column 14px wide, and a furigana gloss 6px wide sitting right
    // against it, which is under the network of real proportions in a manga
    // page set at typical body and ruby sizes.
    const width = 24;
    const mask = maskWithColumns(width, [
      [0, 14], // main column
      [16, 22], // furigana, gap of 2 to the main column
    ]);

    const result = stripFurigana(mask, width, HEIGHT, { adjacencyGap: 3 });

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toMatchObject({ start: 16, end: 22 });

    // The main column survives untouched.
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < 14; x++) expect(result.mask[y * width + x]).toBe(1);
    }
    // The furigana column is gone.
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 16; x < 22; x++) expect(result.mask[y * width + x]).toBe(0);
    }
  });

  it("leaves a lone narrow column alone, with nothing to be a gloss for", () => {
    // One line of text with no companion column at all. Never furigana,
    // because furigana cannot exist without a base character beside it.
    const mask = maskWithColumns(20, [[6, 12]]);
    const result = stripFurigana(mask, 20, HEIGHT);

    expect(result.removed).toHaveLength(0);
    expect(result.mask).toEqual(mask);
  });

  it("leaves two ordinary body text columns of similar width alone", () => {
    // Two real lines of kanji-weight text, not a base column and its gloss.
    const width = 40;
    const mask = maskWithColumns(width, [
      [2, 16],
      [22, 36],
    ]);

    const result = stripFurigana(mask, width, HEIGHT);

    expect(result.removed).toHaveLength(0);
  });

  it("does not remove a narrow column that is not touching any wide column", () => {
    const width = 40;
    const mask = maskWithColumns(width, [
      [0, 14], // main column
      [30, 36], // narrow, but far from the main column
    ]);

    const result = stripFurigana(mask, width, HEIGHT, { adjacencyGap: 3 });

    expect(result.removed).toHaveLength(0);
  });

  it("removes a gloss on either side of the column it annotates", () => {
    const width = 30;
    // Furigana before (to the left of) its column, the mirror image of the
    // usual manga layout, still has to be caught the same way.
    const mask = maskWithColumns(width, [
      [0, 6], // furigana
      [8, 22], // main column
    ]);

    const result = stripFurigana(mask, width, HEIGHT, { adjacencyGap: 3 });

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]!.start).toBe(0);
  });

  it("handles a real looking bubble: two text columns, one with a gloss", () => {
    const width = 50;
    const mask = maskWithColumns(width, [
      [0, 14], // column one, glossed
      [16, 22], // its furigana
      [30, 44], // column two, no gloss
    ]);

    const result = stripFurigana(mask, width, HEIGHT, { adjacencyGap: 3 });

    expect(result.removed).toHaveLength(1);
    expect(result.removed[0]).toMatchObject({ start: 16, end: 22 });

    // Both real text columns survive.
    for (const [start, end] of [
      [0, 14],
      [30, 44],
    ] as const) {
      for (let y = 0; y < HEIGHT; y++) {
        for (let x = start; x < end; x++) expect(result.mask[y * width + x]).toBe(1);
      }
    }
  });

  it("never removes every band, even if every band looks narrow", () => {
    // If nothing in the region is unambiguously the main column, the safe
    // answer is to touch nothing rather than guess and erase real text.
    const width = 30;
    const mask = maskWithColumns(width, [
      [0, 6],
      [10, 16],
      [20, 26],
    ]);

    const result = stripFurigana(mask, width, HEIGHT, { adjacencyGap: 3 });
    const untouchedBands = result.columns.length - result.removed.length;

    expect(untouchedBands).toBeGreaterThan(0);
  });

  it("returns the same mask reference shape when nothing is removed", () => {
    const mask = maskWithColumns(20, [[4, 14]]);
    const result = stripFurigana(mask, 20, HEIGHT);

    expect(result.mask).toBe(mask);
  });
});
