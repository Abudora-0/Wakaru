import type { DictionaryProvider } from "../types";
import { createDictionaryApiDevProvider } from "./dictionaryapi-dev";
import { createWiktionaryProvider } from "./wiktionary";
import { createJishoProvider } from "./jisho";
import { DictionaryChain } from "./chain";

export { DictionaryChain } from "./chain";
export type { DictionaryChainOptions } from "./chain";
export { createDictionaryApiDevProvider } from "./dictionaryapi-dev";
export { createWiktionaryProvider, findLanguagesForWord } from "./wiktionary";
export { createJishoProvider } from "./jisho";
export { fetchWiktionaryAudio } from "./wiktionary-audio";
export { fetchRelatedWords, DATAMUSE_ATTRIBUTION } from "./datamuse";

export function createDictionaryProviders(): DictionaryProvider[] {
  return [createDictionaryApiDevProvider(), createJishoProvider(), createWiktionaryProvider()];
}

export function createDictionaryChain(): DictionaryChain {
  return new DictionaryChain({ providers: createDictionaryProviders() });
}
