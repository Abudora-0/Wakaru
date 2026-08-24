import type { Direction, LangCode, ScriptCode } from "../types.js";

/**
 * One substitution applied after translation.
 *
 * Confidence is honest rather than decorative. "high" means the word is simply
 * wrong in the target region. "medium" means it is understood but marked.
 * "low" means it is a register or slang preference. The interface exposes the
 * level so a user can decide whether to keep an edit.
 */
export interface LexiconEntry {
  from: string;
  to: string;
  confidence: "high" | "medium" | "low";
  note?: string;
}

export interface DialectDefinition {
  /** BCP-47 tag, for example es-MX, pa-Arab-PK or zh-Hant-HK. */
  code: LangCode;
  /** The base language this dialect refines. */
  base: LangCode;
  name: string;
  native: string;
  region: string;

  /** Only set when the dialect uses a different script from its base. */
  script?: ScriptCode;
  dir?: Direction;

  /**
   * Locale to pass to the translation provider. Only a few providers honour
   * region subtags, so the chain falls back to the base code when they do not.
   */
  providerLocale?: string;

  /** Preferred Web Speech voice locales, most specific first. */
  ttsLocales: string[];

  /** What this dialect actually changes, shown on the languages page. */
  summary: string;

  /** Post translation substitutions, applied longest match first. */
  lexicon?: LexiconEntry[];

  /** Identifier of a transliteration rule set in translit.ts. */
  transliterate?: string;

  /** Orthographic rules that are mechanical rather than lexical. */
  orthography?: { pattern: string; replace: string; note?: string }[];
}
