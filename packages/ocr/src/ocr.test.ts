import { describe, expect, it } from "vitest";
import { cleanText } from "./engine";
import { dedupeOverlapping, looksVertical, overlapFraction, sortReadingOrder } from "./bubbles";
import { otsuThreshold } from "./preprocess";

/** Build a fake greyscale RGBA buffer from a list of luma values. */
function buffer(values: number[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });
  return data;
}

describe("otsu threshold", () => {
  it("lands between two clearly separated peaks", () => {
    const values = [...Array(100).fill(20), ...Array(100).fill(230)];
    const threshold = otsuThreshold(buffer(values));
    expect(threshold).toBeGreaterThan(20);
    expect(threshold).toBeLessThan(230);
  });

  it("adapts to a dark page rather than assuming the midpoint", () => {
    // A dimly scanned page: ink at 5, paper at 120. A fixed 128 would turn
    // the whole page black.
    const values = [...Array(60).fill(5), ...Array(140).fill(120)];
    const threshold = otsuThreshold(buffer(values));
    expect(threshold).toBeGreaterThan(5);
    expect(threshold).toBeLessThan(120);
  });
});

describe("text cleanup", () => {
  it("removes the spaces Tesseract inserts between CJK characters", () => {
    expect(cleanText("こ ん に ち は")).toBe("こんにちは");
    expect(cleanText("你 好 世 界")).toBe("你好世界");
    expect(cleanText("안 녕 하 세 요")).toBe("안녕하세요");
  });

  it("folds a vertical column back into one line", () => {
    expect(cleanText("お\nは\nよ\nう")).toBe("おはよう");
  });

  it("keeps spaces inside Latin text", () => {
    expect(cleanText("hello  there\nfriend")).toBe("hello there friend");
  });

  it("returns an empty string for whitespace only output", () => {
    expect(cleanText("   \n  \n ")).toBe("");
  });
});

describe("reading order", () => {
  it("reads right to left within a row, then down the page", () => {
    const boxes = [
      { x: 10, y: 300, width: 80, height: 60 },
      { x: 400, y: 10, width: 80, height: 60 },
      { x: 40, y: 10, width: 80, height: 60 },
    ];
    const sorted = sortReadingOrder(boxes);
    expect(sorted.map((box) => `${box.x},${box.y}`)).toEqual(["400,10", "40,10", "10,300"]);
  });

  it("can be flipped for left to right scripts", () => {
    const boxes = [
      { x: 400, y: 10, width: 80, height: 60 },
      { x: 40, y: 10, width: 80, height: 60 },
    ];
    expect(sortReadingOrder(boxes, false)[0]?.x).toBe(40);
  });
});

describe("orientation", () => {
  it("treats a tall narrow bubble as vertical text", () => {
    expect(looksVertical({ x: 0, y: 0, width: 60, height: 220 })).toBe(true);
  });

  it("treats a wide bubble as horizontal", () => {
    expect(looksVertical({ x: 0, y: 0, width: 220, height: 90 })).toBe(false);
  });
});

describe("overlapFraction", () => {
  it("is zero for boxes that do not touch", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 50, y: 50, width: 10, height: 10 };
    expect(overlapFraction(a, b)).toBe(0);
  });

  it("is one when a box is fully inside another", () => {
    const outer = { x: 0, y: 0, width: 100, height: 100 };
    const inner = { x: 10, y: 10, width: 20, height: 20 };
    expect(overlapFraction(outer, inner)).toBe(1);
    // Symmetric: measured against the smaller box either way round.
    expect(overlapFraction(inner, outer)).toBe(1);
  });

  it("scales with how much of the smaller box is covered", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 0, width: 10, height: 10 };
    // Half of the 10x10 smaller box overlaps.
    expect(overlapFraction(a, b)).toBeCloseTo(0.5, 5);
  });
});

describe("dedupeOverlapping", () => {
  it("keeps two boxes that do not overlap", () => {
    const boxes = [
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 50, y: 50, width: 10, height: 10 },
    ];
    expect(dedupeOverlapping(boxes)).toHaveLength(2);
  });

  it("drops the looser box and keeps the tight one", () => {
    // The exact shape of the real failure: a clean, tight crop of a balloon
    // and a second, larger, mostly overlapping box around it that pulls in
    // extra background. Only the tight one is worth handing to the
    // recogniser.
    const tight = { x: 10, y: 10, width: 20, height: 20 };
    const loose = { x: 5, y: 5, width: 40, height: 40 };

    const kept = dedupeOverlapping([loose, tight]);

    expect(kept).toHaveLength(1);
    expect(kept[0]).toEqual(tight);
  });

  it("keeps the tight box regardless of which order the two arrive in", () => {
    const tight = { x: 10, y: 10, width: 20, height: 20 };
    const loose = { x: 5, y: 5, width: 40, height: 40 };

    expect(dedupeOverlapping([tight, loose])[0]).toEqual(tight);
    expect(dedupeOverlapping([loose, tight])[0]).toEqual(tight);
  });

  it("does not merge two distinct boxes that only partly overlap", () => {
    // Two genuinely separate balloons whose rectangular bounds clip corners,
    // which round shapes do constantly, must both survive.
    const a = { x: 0, y: 0, width: 20, height: 20 };
    const b = { x: 15, y: 15, width: 20, height: 20 };

    expect(dedupeOverlapping([a, b], 0.7)).toHaveLength(2);
  });

  it("respects a custom overlap threshold", () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 4, y: 0, width: 10, height: 10 };

    // 60 percent of the smaller box overlaps here.
    expect(dedupeOverlapping([a, b], 0.9)).toHaveLength(2);
    expect(dedupeOverlapping([a, b], 0.5)).toHaveLength(1);
  });

  it("leaves an empty list empty", () => {
    expect(dedupeOverlapping([])).toEqual([]);
  });
});
