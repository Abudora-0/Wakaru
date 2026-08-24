import type { DictionaryProvider } from "../types.js";
import { createDictionaryApiDevProvider } from "./dictionaryapi-dev.js";
import { createWiktionaryProvider } from "./wiktionary.js";
import { DictionaryChain } from "./chain.js";

export { DictionaryChain } from "./chain.js";
export type { DictionaryChainOptions } from "./chain.js";
export { createDictionaryApiDevProvider } from "./dictionaryapi-dev.js";
export { createWiktionaryProvider, findLanguagesForWord } from "./wiktionary.js";
export { fetchWiktionaryAudio } from "./wiktionary-audio.js";
export { fetchRelatedWords, DATAMUSE_ATTRIBUTION } from "./datamuse.js";

export function createDictionaryProviders(): DictionaryProvider[] {
  return [createDictionaryApiDevProvider(), createWiktionaryProvider()];
}

export function createDictionaryChain(): DictionaryChain {
  return new DictionaryChain({ providers: createDictionaryProviders() });
}
