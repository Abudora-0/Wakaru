#!/usr/bin/env node
/**
 * Render the brand sources into every raster the apps need.
 *
 * The SVGs in brand/ are the only source of truth. Nothing else in the tree
 * should contain a hand made copy of the mark, so this script writes into both
 * the web app's public directory and the extension's icon directory.
 *
 * Three cuts exist on purpose.
 *
 *   mark.svg            the full drawing, transparent ground. Used in the page
 *                       itself, in the lockup and on the social card.
 *   mark-tile.svg       the same balloon reversed onto a dark tile. Every app
 *                       icon uses this, because a transparent balloon vanishes
 *                       against a dark browser toolbar.
 *   mark-tile-small.svg a heavier redraw of the tile for anything under 64px,
 *                       where the tail and the thin strokes collapse.
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
  { target: WEB_PUBLIC, name: "apple-touch-icon.png", size: 180 },
];

async function main() {
  const tile = await readFile(join(BRAND, "mark-tile.svg"));
  const tileSmall = await readFile(join(BRAND, "mark-tile-small.svg"));

  await mkdir(WEB_PUBLIC, { recursive: true });
  await mkdir(EXT_ICONS, { recursive: true });

  for (const output of OUTPUTS) {
    const source = output.size <= SMALL_CUT_MAX ? tileSmall : tile;
    const pipeline = sharp(source).resize(output.size, output.size);

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
  await writeFile(join(WEB_PUBLIC, "favicon.svg"), tileSmall);
  console.log("  favicon.svg            vector");

  // A raster fallback for the handful of clients that still ignore SVG icons.
  await sharp(tileSmall).resize(32, 32).png().toFile(join(WEB_PUBLIC, "favicon.png"));
  console.log("  favicon.png            32px");

  console.log("\nBrand assets rebuilt from brand/*.svg");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
