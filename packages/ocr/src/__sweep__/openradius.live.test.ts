import { readdirSync } from "node:fs";
import { extname, join } from "node:path";
import sharp from "sharp";
import { describe, it } from "vitest";
import { boxesFromMask } from "../bubbles";
import { binarize, otsuThreshold, stretchContrast, toGreyscale } from "../preprocess";

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

/**
 * How much opening radius does it take to separate balloons sharing a panel.
 *
 * This is what found the actual cause of the worst real merge on record: a
 * detected region spanning three balloons and the character art between
 * them, inside one manga panel with no internal borders of its own. Plain
 * connected component labelling on the raw ink mask, with no morphology at
 * all, produced the identical merge, which ruled out fillTextHoles as the
 * cause and pointed at something more structural: in most art styles a
 * speech bubble tail is drawn as an open wedge rather than a closed loop, so
 * the bubble interior is never actually sealed off from the panel behind it.
 * Severing that channel needs an opening radius wide enough to erase the
 * width of the tail, which turned out to be well past the radius of 2 this
 * project shipped with.
 *
 * Run with: npm run ocr:sweep
 */
describe("opening radius against real panels", () => {
  it("reports box count and the largest box area at each radius", async () => {
    let files: string[] = [];
    try {
      files = readdirSync(PAGES).filter((f) => [".png", ".jpg", ".jpeg"].includes(extname(f).toLowerCase()));
    } catch {
      files = [];
    }
    if (files.length === 0) return;

    for (const file of files) {
      const p = await maskFor(file);
      console.log(`\n${file}`);
      for (const openRadius of [2, 4, 6, 8, 10, 12, 16, 20]) {
        const boxes = boxesFromMask(p.mask, p.width, p.height, p.scale, p.sourceWidth, p.sourceHeight, { openRadius });
        const pageArea = p.sourceWidth * p.sourceHeight;
        const areas = boxes.map((b) => Math.round(((b.width * b.height) / pageArea) * 1000) / 10);
        areas.sort((a, b) => b - a);
        console.log(`  radius ${String(openRadius).padStart(2)}: ${boxes.length} boxes, largest ${areas.slice(0, 3).join(", ")} percent of page`);
      }
    }
  }, 120_000);
});
