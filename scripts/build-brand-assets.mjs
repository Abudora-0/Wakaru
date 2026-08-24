#!/usr/bin/env node
/**
 * Render the brand sources into every raster the apps need.
 *
 * The SVGs in brand/ are the only source of truth. Nothing else in the tree
 * should contain a hand made copy of the mark, so this script writes into both
 * the web app's public directory and the extension's icon directory.
 *
 * Two cuts exist on purpose. mark.svg is the full drawing with the tail and
 * the trailing drops. mark-small.svg is a separate, heavier drawing used below
 * 64 pixels, where the fine detail in the full mark turns to mush.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const BRAND = join(ROOT, "brand");
const WEB_PUBLIC = join(ROOT, "apps", "web", "public");
const EXT_ICONS = join(ROOT, "apps", "extension", "public", "icon");

/** Below this size the simplified cut is used instead. */
const SMALL_CUT_MAX = 64;

const OUTPUTS = [
  // Extension icons. Chrome shows 16 in the toolbar and 128 in the store.
  { target: EXT_ICONS, name: "16.png", size: 16 },
  { target: EXT_ICONS, name: "32.png", size: 32 },
  { target: EXT_ICONS, name: "48.png", size: 48 },
  { target: EXT_ICONS, name: "128.png", size: 128 },

  // Web app icons.
  { target: WEB_PUBLIC, name: "icon-192.png", size: 192 },
  { target: WEB_PUBLIC, name: "icon-512.png", size: 512 },
  { target: WEB_PUBLIC, name: "apple-touch-icon.png", size: 180, background: "#f4efe6" },
];

async function main() {
  const full = await readFile(join(BRAND, "mark.svg"));
  const small = await readFile(join(BRAND, "mark-small.svg"));

  await mkdir(WEB_PUBLIC, { recursive: true });
  await mkdir(EXT_ICONS, { recursive: true });

  for (const output of OUTPUTS) {
    const source = output.size <= SMALL_CUT_MAX ? small : full;
    let pipeline = sharp(source).resize(output.size, output.size);

    // Apple's touch icon is composited on an opaque tile by iOS anyway, so it
    // gets the paper ground rather than transparency.
    if (output.background) pipeline = pipeline.flatten({ background: output.background });

    await pipeline.png({ compressionLevel: 9 }).toFile(join(output.target, output.name));
    console.log(`  ${output.name.padEnd(22)} ${output.size}px`);
  }

  // The social card.
  await sharp(await readFile(join(BRAND, "og.svg")))
    .resize(1200, 630)
    .png({ compressionLevel: 9 })
    .toFile(join(WEB_PUBLIC, "og.png"));
  console.log("  og.png                 1200x630");

  // The favicon is served as SVG so it stays sharp at any size and follows
  // the browser theme. The small cut is used because tabs are tiny.
  await writeFile(join(WEB_PUBLIC, "favicon.svg"), small);
  console.log("  favicon.svg            vector");

  // A raster fallback for the handful of clients that still ignore SVG icons.
  await sharp(small).resize(32, 32).png().toFile(join(WEB_PUBLIC, "favicon.png"));
  console.log("  favicon.png            32px");

  console.log("\nBrand assets rebuilt from brand/*.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
