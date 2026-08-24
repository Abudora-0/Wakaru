import { describe, expect, it } from "vitest";
import { cleanText } from "./engine";
import { looksVertical, sortReadingOrder } from "./bubbles";
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
