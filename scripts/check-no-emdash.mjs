#!/usr/bin/env node
/**
 * Wakaru house style guard.
 *
 * The project forbids em dashes in source, UI copy and documentation. This runs
 * in the pre-commit hook and in CI so the rule fails a build instead of relying
 * on anyone remembering it during review.
 *
 * The forbidden characters are referenced by code point rather than written
 * literally, otherwise this file would report itself on every run.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Characters that are never allowed in tracked source or docs. */
const BANNED = [
  { code: 0x2014, name: "EM DASH", suggest: "use a comma, a colon, or split the sentence" },
  { code: 0x2015, name: "HORIZONTAL BAR", suggest: "use a comma or split the sentence" },
];

const BANNED_CHARS = new Set(BANNED.map((b) => String.fromCharCode(b.code)));
const BY_CHAR = new Map(BANNED.map((b) => [String.fromCharCode(b.code), b]));

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".output", ".wxt", "dist", "build",
  "out", "coverage", "playwright-report", "test-results", ".vercel",
]);

const CHECK_EXT = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".html", ".svg",
  ".json", ".jsonc", ".md", ".mdx", ".yml", ".yaml", ".txt",
]);

/** Files that legitimately carry third party text we do not rewrite. */
const ALLOWLIST = new Set([
  join("package-lock.json"),
]);

async function walk(dir, out = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, out);
    } else if (entry.isFile() && CHECK_EXT.has(extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function scan(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (BANNED_CHARS.has(ch)) {
        hits.push({ line: i + 1, col: col + 1, char: ch, text: line.trim() });
      }
    }
  }
  return hits;
}

async function main() {
  const files = await walk(ROOT);
  let failures = 0;

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (ALLOWLIST.has(rel)) continue;

    const text = await readFile(file, "utf8");
    const hits = scan(text);
    if (hits.length === 0) continue;

    for (const hit of hits) {
      const info = BY_CHAR.get(hit.char);
      const loc = `${rel.split(sep).join("/")}:${hit.line}:${hit.col}`;
      console.error(`\x1b[31m${loc}\x1b[0m  ${info.name} found. ${info.suggest}.`);
      console.error(`    ${hit.text}`);
      failures++;
    }
  }

  if (failures > 0) {
    console.error("");
    console.error(`\x1b[31mFAIL\x1b[0m  ${failures} banned character(s) across the tree.`);
    console.error("Wakaru house style does not use em dashes in code, UI copy or docs.");
    process.exit(1);
  }

  console.log(`\x1b[32mOK\x1b[0m  ${files.length} files checked, no banned characters.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
