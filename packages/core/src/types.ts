/**
 * Shared vocabulary for the whole platform.
 *
 * Every provider normalises into these shapes, so the user interface never
 * branches on which upstream source answered a request.
 */

/** A BCP-47 tag. Base languages are "ja" or "ur", dialects are "es-MX" or "pa-Arab". */
export type LangCode = string;

/** ISO 15924 script code, for example Latn, Arab, Jpan, Hang, Deva. */
export type ScriptCode = string;

export type Direction = "ltr" | "rtl";

export interface Attribution {
  /** Human readable source name, shown in the entry margin. */
  source: string;
  /** Licence identifier, for example "CC BY-SA 4.0". */
  license: string;
  /** Link to the licence or to the source page. */
  url: string;
}

/* ---------------------------------------------------------------- translate */

export interface TranslationRequest {
  text: string;
  /** "auto" asks the provider to detect the source language. */
  from: LangCode | "auto";
  to: LangCode;
}

/** What a single provider returns before the dialect layer runs. */
export interface ProviderTranslation {
  text: string;
  detectedFrom?: LangCode;
  /** Provider reported quality between 0 and 1, where the provider offers one. */
  match?: number;
  alternatives?: string[];
}

/** A word or phrase the dialect layer rewrote, so the interface can show it. */
export interface DialectEdit {
  from: string;
  to: string;
  note?: string;
  confidence: "high" | "medium" | "low";
}

export interface TranslationResult extends ProviderTranslation {
  from: LangCode;
  to: LangCode;
  /** Identifier of the provider that served this result. */
  provider: string;
  /** Providers that were tried and failed before this one succeeded. */
  fellBackFrom: string[];
  /** Present when the target was a dialect and the overlay changed something. */
  dialectEdits: DialectEdit[];
  /** True when the result came out of the cache rather than the network. */
  cached: boolean;
  attribution: Attribution[];
}

export interface TranslateProvider {
  readonly id: string;
  readonly label: string;
  /** False when the provider needs an operator supplied URL or key to work. */
  readonly ready: boolean;
  /** Documented daily character budget, or null when effectively unlimited. */
  readonly dailyCharBudget: number | null;
  supports(from: LangCode | "auto", to: LangCode): boolean;
  translate(req: TranslationRequest, signal?: AbortSignal): Promise<ProviderTranslation>;
  readonly attribution: Attribution;
}

/* -------------------------------------------------------------- dictionary */

export interface Example {
  text: string;
  translation?: string;
  source?: string;
}

export interface Pronunciation {
  /** International Phonetic Alphabet transcription. */
  ipa?: string;
  /** Playable recording of a human speaker, where one exists. */
  audioUrl?: string;
  /** Accent or region label, for example "Received Pronunciation" or "en-US". */
  accent?: string;
  source: string;
}

export interface Sense {
  partOfSpeech: string;
  definition: string;
  examples: Example[];
  synonyms: string[];
  antonyms: string[];
}

/** The single shape every dictionary provider produces. */
export interface UnifiedEntry {
  word: string;
  lang: LangCode;
  script: ScriptCode;
  dir: Direction;
  /** Reading or romanisation, rendered as ruby text above the headword. */
  reading?: string;
  pronunciations: Pronunciation[];
  senses: Sense[];
  synonyms: string[];
  antonyms: string[];
  /** Other forms of the same lemma, for example plurals or conjugations. */
  forms: string[];
  etymology?: string;
  /** Which providers contributed, required by the Wiktionary licence. */
  attribution: Attribution[];
  /** Providers that answered, in the order they were merged. */
  sources: string[];
}

export interface DictionaryProvider {
  readonly id: string;
  readonly label: string;
  supports(lang: LangCode): boolean;
  lookup(word: string, lang: LangCode, signal?: AbortSignal): Promise<Partial<UnifiedEntry> | null>;
  readonly attribution: Attribution;
}

/* ------------------------------------------------------------------ errors */

export type ProviderErrorKind =
  | "network"
  | "timeout"
  | "rate_limit"
  | "unsupported"
  | "not_found"
  | "bad_response"
  | "not_configured";

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly provider: string;
  readonly status?: number;

  constructor(provider: string, kind: ProviderErrorKind, message: string, status?: number) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }

  /** Rate limits and outages are worth retrying later, a bad request is not. */
  get retryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "rate_limit";
  }
}
