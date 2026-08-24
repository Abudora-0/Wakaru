import type { DialectEdit, LangCode } from "../types.js";
import { DIALECTS } from "./data.js";
import type { DialectDefinition, LexiconEntry } from "./types.js";
import { getRuleSet, transliterate } from "./translit.js";

export type { DialectDefinition, LexiconEntry } from "./types.js";
export { DIALECTS } from "./data.js";
export { RULE_SETS, getRuleSet, transliterate } from "./translit.js";

const BY_CODE = new Map<LangCode, DialectDefinition>(DIALECTS.map((d) => [d.code, d]));

const BY_BASE = ((): Map<LangCode, DialectDefinition[]> => {
  const map = new Map<LangCode, DialectDefinition[]>();
  for (const dialect of DIALECTS) {
    const list = map.get(dialect.base) ?? [];
    list.push(dialect);
    map.set(dialect.base, list);
  }
  return map;
})();

export function getDialect(code: LangCode): DialectDefinition | undefined {
  return BY_CODE.get(code);
}

export function dialectsFor(base: LangCode): readonly DialectDefinition[] {
  return BY_BASE.get(base) ?? [];
}

export function hasDialects(base: LangCode): boolean {
  return BY_BASE.has(base);
}

/** Strip a dialect tag back to the base language a provider will recognise. */
export function baseOf(code: LangCode): LangCode {
  const dialect = BY_CODE.get(code);
  if (dialect) return dialect.base;
  const [base] = code.split("-");
  return base ?? code;
}

/**
 * What to actually send upstream. Most free providers reject a region subtag
 * outright, so a locale is only passed through when the dialect declares that
 * the provider understands it.
 */
export function providerLocaleFor(code: LangCode): LangCode {
  const dialect = BY_CODE.get(code);
  if (!dialect) return code;
  return dialect.providerLocale ?? dialect.base;
}

/** Voice locales to try, most specific first, before giving up on audio. */
export function ttsLocalesFor(code: LangCode): string[] {
  const dialect = BY_CODE.get(code);
  if (dialect) return [...dialect.ttsLocales, dialect.base];
  return [code, baseOf(code)];
}

/* ------------------------------------------------------------------ apply */

/** Scripts that do not separate words, where a word boundary check is wrong. */
const UNSPACED_SCRIPTS = new Set(["Hani", "Hans", "Hant", "Jpan", "Hira", "Kana", "Thai", "Khmr", "Laoo", "Mymr"]);

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a matcher for one lexicon term.
 *
 * Latin, Cyrillic and similar scripts get a boundary check built from Unicode
 * letter classes, because the ASCII word boundary treats an accented letter as
 * a boundary and would happily rewrite the middle of a word. Scripts without
 * spaces fall back to a plain substring match, which is correct for them.
 */
function buildMatcher(term: string, script: string): RegExp {
  const escaped = escapeRegex(term);
  if (UNSPACED_SCRIPTS.has(script)) {
    return new RegExp(escaped, "gu");
  }
  return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "giu");
}

/** Carry the casing of the original token onto the replacement. */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  const firstOriginal = original.charAt(0);
  if (firstOriginal && firstOriginal === firstOriginal.toUpperCase() && firstOriginal !== firstOriginal.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export interface DialectApplication {
  text: string;
  edits: DialectEdit[];
  /** Set when a transliteration ran and discarded information. */
  lossyNote?: string;
}

/**
 * Run the dialect layer over a finished translation.
 *
 * Order matters. Orthography first, because those are mechanical spelling
 * rules. Lexicon second, longest term first so that a multi word phrase wins
 * over any single word inside it. Transliteration last, because it changes the
 * script and nothing after it could match.
 */
export function applyDialect(text: string, dialectCode: LangCode, script = "Latn"): DialectApplication {
  const dialect = BY_CODE.get(dialectCode);
  if (!dialect) return { text, edits: [] };

  const edits: DialectEdit[] = [];
  let out = text;

  for (const rule of dialect.orthography ?? []) {
    const pattern = new RegExp(rule.pattern, "gu");
    out = out.replace(pattern, (match) => {
      const replaced = match.replace(new RegExp(rule.pattern, "u"), rule.replace);
      if (replaced !== match) {
        edits.push({
          from: match,
          to: replaced,
          confidence: "high",
          ...(rule.note ? { note: rule.note } : {}),
        });
      }
      return replaced;
    });
  }

  const lexicon: LexiconEntry[] = [...(dialect.lexicon ?? [])].sort((a, b) => b.from.length - a.from.length);

  for (const entry of lexicon) {
    const matcher = buildMatcher(entry.from, dialect.script ?? script);
    out = out.replace(matcher, (match) => {
      const replacement = matchCase(match, entry.to);
      if (replacement === match) return match;
      edits.push({
        from: match,
        to: replacement,
        confidence: entry.confidence,
        ...(entry.note ? { note: entry.note } : {}),
      });
      return replacement;
    });
  }

  let lossyNote: string | undefined;
  if (dialect.transliterate) {
    const ruleSet = getRuleSet(dialect.transliterate);
    const before = out;
    out = transliterate(out, dialect.transliterate);
    if (ruleSet && !ruleSet.lossless && out !== before) {
      lossyNote = ruleSet.caveat;
    }
  }

  return lossyNote ? { text: out, edits, lossyNote } : { text: out, edits };
}
