/**
 * Wakaru core.
 *
 * Everything in this package is framework free on purpose, so the Next.js app
 * and the browser extension run exactly the same provider logic, language data
 * and dialect rules rather than two implementations that drift apart.
 */

export * from "./types.js";

export { LANGUAGES, getLanguage, isSupported, directionOf, scriptOf, searchLanguages, groupByScript, totalDialectCount } from "./languages/index.js";
export type { Language } from "./languages/index.js";

export {
  DIALECTS, RULE_SETS, applyDialect, baseOf, dialectsFor, getDialect, getRuleSet,
  hasDialects, providerLocaleFor, transliterate, ttsLocalesFor,
} from "./dialects/index.js";
export type { DialectApplication } from "./dialects/index.js";
export type { DialectDefinition, LexiconEntry } from "./dialects/types.js";

export {
  TranslateChain, createTranslateChain, createTranslateProviders, translateSetupFromEnv,
  createMyMemoryProvider, createLibreTranslateProvider, createGoogleGtxProvider, segmentText,
} from "./translate/index.js";
export type { ChainTranslateRequest, TranslateSetup } from "./translate/index.js";

export {
  DictionaryChain, createDictionaryChain, createDictionaryProviders,
  createDictionaryApiDevProvider, createWiktionaryProvider,
  findLanguagesForWord, fetchWiktionaryAudio, fetchRelatedWords,
} from "./dictionary/index.js";

export { speak, stopSpeaking, matchVoice, loadVoices, speechSupported } from "./speech/index.js";
export type { SpeakOptions, SpeakOutcome, VoiceMatch } from "./speech/index.js";

export { Lru } from "./util/lru.js";
export { stripWikiHtml, extractExample } from "./util/html.js";
