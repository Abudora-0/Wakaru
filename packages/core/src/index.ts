/**
 * Wakaru core.
 *
 * Everything in this package is framework free on purpose, so the Next.js app
 * and the browser extension run exactly the same provider logic, language data
 * and dialect rules rather than two implementations that drift apart.
 */

export * from "./types";

export { LANGUAGES, getLanguage, isSupported, directionOf, scriptOf, searchLanguages, groupByScript, totalDialectCount } from "./languages/index";
export type { Language } from "./languages/index";

export {
  DIALECTS, RULE_SETS, applyDialect, baseOf, dialectsFor, getDialect, getRuleSet,
  hasDialects, providerLocaleFor, transliterate, ttsLocalesFor,
} from "./dialects/index";
export type { DialectApplication } from "./dialects/index";
export type { DialectDefinition, LexiconEntry } from "./dialects/types";

export {
  TranslateChain, createTranslateChain, createTranslateProviders, translateSetupFromEnv,
  createMyMemoryProvider, createLibreTranslateProvider, createGoogleGtxProvider, segmentText,
} from "./translate/index";
export type { ChainTranslateRequest, TranslateSetup } from "./translate/index";

export {
  DictionaryChain, createDictionaryChain, createDictionaryProviders,
  createDictionaryApiDevProvider, createWiktionaryProvider,
  findLanguagesForWord, fetchWiktionaryAudio, fetchRelatedWords,
} from "./dictionary/index";

export {
  speak, stopSpeaking, matchVoice, loadVoices, speechSupported, spokenLanguages,
  voiceLikelihood, voiceAvailability, spokenByMostPlatforms,
  piperVoiceFor, piperLanguages, PIPER_MODEL_MB,
} from "./speech/index";
export type { SpeakOptions, SpeakOutcome, VoiceMatch, VoiceLikelihood, VoiceAvailability } from "./speech/index";

export { Lru } from "./util/lru";
export { stripWikiHtml, extractExample, escapeRegExp } from "./util/html";
