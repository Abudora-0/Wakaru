import { describe, expect, it } from "vitest";
import { close, dilate, erode, fillTextHoles, open } from "./morphology";

const WIDTH = 60;
const HEIGHT = 60;

function blank(fill: 0 | 1 = 1): Uint8Array {
  return new Uint8Array(WIDTH * HEIGHT).fill(fill);
}

/** Punch a rectangle of the given value into a mask, in place. */
function paint(mask: Uint8Array, width: number, x0: number, y0: number, x1: number, y1: number, value: 0 | 1): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) mask[y * width + x] = value;
  }
}

describe("fillTextHoles", () => {
  it("fills a small dark mark surrounded by light, the way a letter stroke sits in a balloon", () => {
    const mask = blank(1);
    paint(mask, WIDTH, 25, 25, 30, 30, 0);

    const result = fillTextHoles(mask, WIDTH, HEIGHT, 10);

    expect(result[27 * WIDTH + 27]).toBe(1);
  });

  it("leaves a mark of the same size alone when it sits among denser ink", () => {
    // The same five pixel mark, but this time most of its neighbourhood is
    // already dark, the way a line art detail sits inside hair or shading
    // rather than inside a mostly blank balloon.
    const mask = blank(1);
    paint(mask, WIDTH, 0, 0, WIDTH, HEIGHT, 0);
    paint(mask, WIDTH, 25, 25, 30, 30, 0);

    const result = fillTextHoles(mask, WIDTH, HEIGHT, 10);

    // Nothing here is light to begin with, so nothing should have changed.
    expect(result[27 * WIDTH + 27]).toBe(0);
  });

  it("never fills a shape that touches the edge of the mask", () => {
    const mask = blank(1);
    paint(mask, WIDTH, 0, 0, 5, 5, 0);

    const result = fillTextHoles(mask, WIDTH, HEIGHT, 10);

    expect(result[2 * WIDTH + 2]).toBe(0);
  });

  it("never fills a shape larger than maxGlyph in either dimension", () => {
    const mask = blank(1);
    paint(mask, WIDTH, 10, 10, 40, 16, 0); // 30 wide, well past maxGlyph

    const result = fillTextHoles(mask, WIDTH, HEIGHT, 10);

    expect(result[12 * WIDTH + 20]).toBe(0);
  });

  it("draws the line between the two cases at maxContextInk", () => {
    // A mark with roughly a third of its surrounding window already dark.
    // Below the default 0.35 ceiling it is filled; tightening the ceiling
    // below the actual local density must leave it alone.
    const mask = blank(1);
    paint(mask, WIDTH, 0, 0, 20, 60, 0); // a dark block occupying part of the window
    paint(mask, WIDTH, 25, 25, 30, 30, 0); // the candidate mark itself

    const permissive = fillTextHoles(mask, WIDTH, HEIGHT, 10, { maxContextInk: 0.9 });
    const strict = fillTextHoles(mask, WIDTH, HEIGHT, 10, { maxContextInk: 0.05 });

    expect(permissive[27 * WIDTH + 27]).toBe(1);
    expect(strict[27 * WIDTH + 27]).toBe(0);
  });

  it("this is the actual failure mode found on a real page: dense small marks standing for artwork must not bleach to one solid field", () => {
    // A tight grid of small marks, standing in for hair and facial detail
    // packed closely enough to cross the context ceiling, the density that a
    // plain bounding box test cannot distinguish from body text but that a
    // real illustration reaches easily. Before this guard existed, filling
    // every one of these independently by size alone turned exactly this
    // kind of area into one solid light field, which is what merged three
    // separate balloons and the artwork between them into a single detected
    // region on a real page.
    const mask = blank(1);
    for (let y = 2; y < HEIGHT; y += 5) {
      for (let x = 2; x < WIDTH; x += 5) {
        paint(mask, WIDTH, x, y, x + 3, y + 3, 0);
      }
    }

    const result = fillTextHoles(mask, WIDTH, HEIGHT, 6);

    let remaining = 0;
    for (let i = 0; i < result.length; i++) if (result[i] === 0) remaining++;
    expect(remaining).toBeGreaterThan(0);
  });

  it("leaves a mask with no dark pixels at all unchanged", () => {
    const mask = blank(1);
    expect(fillTextHoles(mask, WIDTH, HEIGHT, 10)).toEqual(mask);
  });
});

describe("dilate, erode, close, open", () => {
  it("dilate grows a light region outward by the given radius", () => {
    const mask = blank(0);
    mask[30 * WIDTH + 30] = 1;

    const grown = dilate(mask, WIDTH, HEIGHT, 2);

    expect(grown[30 * WIDTH + 30]).toBe(1);
    expect(grown[30 * WIDTH + 32]).toBe(1);
    expect(grown[30 * WIDTH + 33]).toBe(0);
  });

  it("erode shrinks a light region inward by the given radius", () => {
    const mask = blank(0);
    paint(mask, WIDTH, 20, 20, 40, 40, 1);

    const shrunk = erode(mask, WIDTH, HEIGHT, 2);

    expect(shrunk[30 * WIDTH + 30]).toBe(1);
    expect(shrunk[21 * WIDTH + 21]).toBe(0);
  });

  it("open severs a thin bridge between two light regions without erasing them", () => {
    const mask = blank(0);
    paint(mask, WIDTH, 5, 5, 20, 20, 1);
    paint(mask, WIDTH, 40, 5, 55, 20, 1);
    paint(mask, WIDTH, 20, 11, 40, 13, 1); // a two pixel bridge joining them

    const opened = open(mask, WIDTH, HEIGHT, 2);

    expect(opened[12 * WIDTH + 30]).toBe(0); // the bridge is gone
    expect(opened[12 * WIDTH + 12]).toBe(1); // both regions survive
    expect(opened[12 * WIDTH + 47]).toBe(1);
  });

  it("close fills a small dark hole inside a light region", () => {
    const mask = blank(0);
    paint(mask, WIDTH, 10, 10, 40, 40, 1);
    paint(mask, WIDTH, 20, 20, 22, 22, 0);

    const closed = close(mask, WIDTH, HEIGHT, 3);

    expect(closed[21 * WIDTH + 21]).toBe(1);
  });
});
