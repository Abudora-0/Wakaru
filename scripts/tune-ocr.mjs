#!/usr/bin/env node
/**
 * Bubble detection tuner.
 *
 * The detector's thresholds were reasoned from first principles and have never
 * met real artwork. This drives the actual /read page in a real browser rather
 * than a synthetic harness, so what it measures is what a reader would get:
 * the same preprocessing, the same detector, the same Tesseract models.
 *
 * Translation is stubbed to return the source text unchanged. The question
 * here is what the detector found, and stubbing keeps the run from spending a
 * free daily quota every time the thresholds are nudged.
 *
 *   npm run build          once, this needs a production server
 *   npm run ocr:tune
 *
 * Pages go in fixtures/pages/. Overlays come out in fixtures/out/.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { chromium } from "@playwright/test";

const PAGES = "fixtures/pages";
const OUT = "fixtures/out";
const PORT = 3177;
const BASE = `http://127.0.0.1:${PORT}`;

const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

/** Filenames carry the script, so a mixed folder does not need a flag. */
function scriptFor(name) {
  const lower = name.toLowerCase();
  if (lower.includes("korean") || lower.includes("manhwa")) return "Korean";
  if (lower.includes("traditional")) return "Chinese, traditional";
  if (lower.includes("chinese") || lower.includes("manhua")) return "Chinese, simplified";
  if (lower.includes("english")) return "English";
  return "Japanese";
}

async function waitForServer(url, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server did not start within ${timeoutMs}ms`);
}

async function main() {
  let files;
  try {
    files = (await readdir(PAGES)).filter((name) => IMAGE.has(extname(name).toLowerCase()));
  } catch {
    files = [];
  }

  if (files.length === 0) {
    console.log(`No pages in ${PAGES}/. See fixtures/README.md for what to put there.`);
    return;
  }

  await mkdir(OUT, { recursive: true });

  const server = spawn("npm", ["run", "start", "--workspace", "@wakaru/web", "--", "--port", String(PORT)], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  const report = [];

  try {
    await waitForServer(BASE);

    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

    // Identity translation: this run is about detection, not about wording.
    await page.route("**/api/translate", async (route) => {
      const body = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          text: body?.text ?? "",
          from: body?.from ?? "ja",
          to: body?.to ?? "en",
          provider: "stub",
          fellBackFrom: [],
          dialectEdits: [],
          cached: false,
          attribution: [],
        }),
      });
    });

    for (const file of files) {
      const script = scriptFor(file);
      process.stdout.write(`  ${file.padEnd(34)} ${script.padEnd(22)}`);

      await page.goto(`${BASE}/read`);
      await page.getByRole("button", { name: script, exact: true }).click();
      await page.locator('input[type="file"]').setInputFiles(join(PAGES, file));
      await page.waitForSelector(".plate img");

      const started = Date.now();
      await page.getByRole("button", { name: /Read this page/ }).click();

      // The first page downloads a language model, which is slow.
      await page.waitForSelector(".transcript, .progress[role=alert]", { timeout: 600_000 });
      const elapsed = Date.now() - started;

      const failure = await page.locator(".progress[role=alert]").textContent().catch(() => null);

      const rows = await page.locator(".panelrow").evaluateAll((nodes) =>
        nodes.map((node) => ({
          raw: node.querySelector(".panelrow__raw")?.textContent?.trim() ?? "",
          meta: node.querySelector(".panelrow__meta")?.textContent?.trim() ?? "",
        })),
      );

      const coverage = await page.locator(".bubble").evaluateAll((nodes, _) => {
        const total = nodes.reduce((sum, node) => {
          const style = node.style;
          return sum + (parseFloat(style.width) || 0) * (parseFloat(style.height) || 0);
        }, 0);
        return Math.round(total) / 100;
      });

      const confidences = rows
        .map((row) => Number(/confidence (\d+)/.exec(row.meta)?.[1] ?? 0))
        .filter((value) => value > 0);

      const vertical = rows.filter((row) => row.meta.includes("vertical")).length;

      const entry = {
        file,
        script,
        bubbles: rows.length,
        vertical,
        coveragePercent: Number(coverage.toFixed(1)),
        medianConfidence: confidences.length
          ? confidences.sort((a, b) => a - b)[Math.floor(confidences.length / 2)]
          : 0,
        seconds: Number((elapsed / 1000).toFixed(1)),
        error: failure?.trim() || null,
        samples: rows.slice(0, 3).map((row) => row.raw),
      };

      report.push(entry);
      console.log(
        entry.error
          ? `FAILED  ${entry.error}`
          : `${String(entry.bubbles).padStart(3)} bubbles  ${String(entry.vertical).padStart(2)} vertical  median conf ${String(entry.medianConfidence).padStart(3)}  ${entry.seconds}s`,
      );

      await page.locator(".plate").screenshot({ path: join(OUT, `${basename(file, extname(file))}-overlay.png`) });
    }

    await browser.close();
  } finally {
    server.kill();
  }

  await writeFile(join(OUT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\nOverlays and report.json written to ${OUT}/`);
  console.log("Check the overlays by eye: a good run boxes every bubble and nothing else.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
