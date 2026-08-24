import "server-only";

import { DictionaryChain, TranslateChain, createDictionaryProviders, createTranslateProviders, translateSetupFromEnv } from "@wakaru/core";

/**
 * Chain singletons.
 *
 * These are module scoped on purpose. The chains hold the response cache and
 * the provider circuit breaker, and both are only useful if they survive
 * between requests. On Vercel's Fluid Compute a warm instance serves many
 * requests, so this is where most of the free quota saving actually happens.
 */

let translateChain: TranslateChain | undefined;
let dictionaryChain: DictionaryChain | undefined;

export function getTranslateChain(): TranslateChain {
  if (!translateChain) {
    translateChain = new TranslateChain({
      providers: createTranslateProviders(translateSetupFromEnv(process.env)),
    });
  }
  return translateChain;
}

export function getDictionaryChain(): DictionaryChain {
  if (!dictionaryChain) {
    dictionaryChain = new DictionaryChain({ providers: createDictionaryProviders() });
  }
  return dictionaryChain;
}

/**
 * Cache headers for the CDN.
 *
 * A translation of a given string never changes, so the edge can hold it for a
 * long time and serve stale copies while it revalidates. This is what turns a
 * 5,000 character daily budget into something a public site can survive on.
 */
export const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
} as const;

export const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
} as const;
