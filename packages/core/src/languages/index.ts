import type { Direction, LangCode, ScriptCode } from "../types";
import { LANGUAGE_ROWS } from "./data";
import { dialectsFor } from "../dialects/index";
import type { DialectDefinition } from "../dialects/types";

export interface Language {
  code: LangCode;
  name: string;
  /** What the language calls itself. Shown before the English name. */
  native: string;
  script: ScriptCode;
  dir: Direction;
  family: string;
  /**
   * A single character of the language's own script, used in the combobox.
   * Flags are deliberately avoided: a flag names a country, not a language,
   * and picking one for Arabic or Spanish would be a political statement.
   */
  sample: string;
  dialects: readonly DialectDefinition[];
}

/** First grapheme of the endonym, which is a real sample of the script. */
function sampleGlyph(native: string): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    const first = segmenter.segment(native)[Symbol.iterator]().next();
    if (!first.done) return first.value.segment;
  }
  return [...native][0] ?? "?";
}

export const LANGUAGES: readonly Language[] = LANGUAGE_ROWS.map(([code, name, native, script, dir, family]) => ({
  code,
  name,
  native,
  script,
  dir,
  family,
  sample: sampleGlyph(native),
  dialects: dialectsFor(code),
}));

const BY_CODE = new Map<LangCode, Language>(LANGUAGES.map((l) => [l.code, l]));

export function getLanguage(code: LangCode): Language | undefined {
  const direct = BY_CODE.get(code);
  if (direct) return direct;
  const [base] = code.split("-");
  return base ? BY_CODE.get(base) : undefined;
}

export function isSupported(code: LangCode): boolean {
  return getLanguage(code) !== undefined;
}

/** Reading direction for a tag, defaulting to left to right for unknowns. */
export function directionOf(code: LangCode): Direction {
  return getLanguage(code)?.dir ?? "ltr";
}

export function scriptOf(code: LangCode): ScriptCode {
  return getLanguage(code)?.script ?? "Latn";
}

/** Strip diacritics so that "espanol" finds "Español". */
function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Search across the code, the English name and the endonym.
 *
 * Results are ranked so that an exact code match wins, then a prefix match,
 * then anything containing the query. Someone typing "ja" wants Japanese, not
 * Punjabi, even though Punjabi contains those letters.
 */
export function searchLanguages(query: string, limit = 40): Language[] {
  const q = fold(query);
  if (!q) return LANGUAGES.slice(0, limit);

  const scored: { lang: Language; score: number }[] = [];

  for (const lang of LANGUAGES) {
    const code = lang.code.toLowerCase();
    const name = fold(lang.name);
    const native = fold(lang.native);

    let score = 0;
    if (code === q) score = 100;
    else if (name === q || native === q) score = 90;
    else if (code.startsWith(q)) score = 80;
    else if (name.startsWith(q) || native.startsWith(q)) score = 70;
    else if (name.includes(q) || native.includes(q)) score = 40;
    else if (fold(lang.family).includes(q)) score = 20;
    else {
      // A dialect name is a legitimate way to find its base language.
      const dialectHit = lang.dialects.some(
        (d) => fold(d.name).includes(q) || fold(d.native).includes(q) || d.code.toLowerCase().includes(q),
      );
      if (dialectHit) score = 30;
    }

    if (score > 0) scored.push({ lang, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.lang.name.localeCompare(b.lang.name))
    .slice(0, limit)
    .map((s) => s.lang);
}

/** Grouped for the specimen page, which lists every script we can render. */
export function groupByScript(): Map<ScriptCode, Language[]> {
  const groups = new Map<ScriptCode, Language[]>();
  for (const lang of LANGUAGES) {
    const list = groups.get(lang.script) ?? [];
    list.push(lang);
    groups.set(lang.script, list);
  }
  return groups;
}

export function totalDialectCount(): number {
  return LANGUAGES.reduce((sum, lang) => sum + lang.dialects.length, 0);
}

export { LANGUAGE_ROWS } from "./data";
