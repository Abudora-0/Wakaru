import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { boxesFromMask } from "../bubbles";
import { binarize, otsuThreshold, stretchContrast, toGreyscale } from "../preprocess";

/**
 * Threshold sweep against real pages.
 *
 * Not an assertion, a measurement. It runs the detector's pure half directly
 * with sharp standing in for the canvas, so a whole grid of parameters is
 * tried in seconds rather than needing a browser and a recogniser per cell.
 *
 * Excluded from the normal run, and it prints nothing when fixtures/pages is
 * empty. Run it with: npm run ocr:sweep
 */

const PAGES = "fixtures/pages";
const WORKING = 900;

async function maskFor(file: string) {
  const image = sharp(join(PAGES, file));
  const meta = await image.metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;

  const scale = Math.min(1, WORKING / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  /*
   * Raw colour, then every step from the browser's own pipeline. sharp's
   * greyscale uses Rec.709 weights and the canvas path uses Rec.601, which is
   * enough to move the Otsu threshold and produce a different mask, so even
   * the greyscale conversion has to come from shared code.
   */
  const { data } = await image.resize(width, height).removeAlpha().raw().toBuffer({ resolveWithObject: true });

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = data[i * 3] ?? 0;
    rgba[i * 4 + 1] = data[i * 3 + 1] ?? 0;
    rgba[i * 4 + 2] = data[i * 3 + 2] ?? 0;
    rgba[i * 4 + 3] = 255;
  }

  toGreyscale(rgba);
  stretchContrast(rgba);
  binarize(rgba, otsuThreshold(rgba));

  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = (rgba[i * 4] ?? 0) > 127 ? 1 : 0;

  return { mask, width, height, scale, sourceWidth, sourceHeight };
}

describe("bubble detection sweep", () => {
  it("reports box counts across a parameter grid", async () => {
    let files: string[] = [];
    try {
      files = readdirSync(PAGES).filter((f) => [".png", ".jpg", ".jpeg"].includes(extname(f).toLowerCase()));
    } catch {
      files = [];
    }

    if (files.length === 0) {
      console.log(`No pages in ${PAGES}/, nothing to sweep.`);
      return;
    }

    const prepared: Record<string, Awaited<ReturnType<typeof maskFor>>> = {};
    for (const file of files) prepared[file] = await maskFor(file);

    const header = ["open", "glyph", "maxA", "fill"].map((h) => h.padStart(6)).join("");
    console.log(`${header}  ${files.map((f) => f.slice(0, 14).padEnd(16)).join("")}median box`);
    console.log("-".repeat(96));

    for (const openRadius of [0, 1, 2, 3, 5]) {
      for (const maxGlyphRatio of [0.05, 0.08]) {
        for (const maxAreaRatio of [0.1, 0.18, 0.28]) {
          for (const minFillRatio of [0.35, 0.5]) {
            const cells: string[] = [];
            const areas: number[] = [];

            for (const file of files) {
              const p = prepared[file]!;
              const boxes = boxesFromMask(p.mask, p.width, p.height, p.scale, p.sourceWidth, p.sourceHeight, {
                openRadius,
                maxGlyphRatio,
                maxAreaRatio,
                minFillRatio,
              });
              const pageArea = p.sourceWidth * p.sourceHeight;
              for (const b of boxes) areas.push((b.width * b.height) / pageArea);
              cells.push(`${String(boxes.length).padStart(3)} boxes`.padEnd(16));
            }

            areas.sort((a, b) => a - b);
            const median = areas.length ? (areas[Math.floor(areas.length / 2)]! * 100).toFixed(1) : "0.0";

            console.log(
              [openRadius, maxGlyphRatio, maxAreaRatio, minFillRatio].map((v) => String(v).padStart(6)).join("") +
                `  ${cells.join("")}${median}%`,
            );
          }
        }
      }
    }
  }, 300_000);
});
