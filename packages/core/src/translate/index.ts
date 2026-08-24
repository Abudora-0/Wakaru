import type { TranslateProvider } from "../types.js";
import { createMyMemoryProvider } from "./mymemory.js";
import { createLibreTranslateProvider } from "./libretranslate.js";
import { createGoogleGtxProvider } from "./google-gtx.js";
import { TranslateChain } from "./chain.js";

export { TranslateChain } from "./chain.js";
export type { ChainTranslateRequest, TranslateChainOptions } from "./chain.js";
export { createMyMemoryProvider, segmentText } from "./mymemory.js";
export { createLibreTranslateProvider, fetchLibreTranslateLanguages } from "./libretranslate.js";
export { createGoogleGtxProvider } from "./google-gtx.js";

export interface TranslateSetup {
  /** Base URL of a self hosted LibreTranslate, if one is running. */
  libreTranslateUrl?: string;
  libreTranslateApiKey?: string;
  /** Operator email that lifts the MyMemory daily budget to 50,000 characters. */
  myMemoryEmail?: string;
  /** Opt in to the undocumented Google endpoint. Off unless explicitly set. */
  enableGoogleGtx?: boolean;
}

/**
 * Build the provider chain in priority order.
 *
 * A self hosted LibreTranslate goes first when one is configured, because it
 * has no quota and no third party involved. MyMemory is the zero setup default
 * that makes the project work the moment it is cloned. The unofficial Google
 * endpoint sits last and only appears when an operator turns it on.
 */
export function createTranslateProviders(setup: TranslateSetup = {}): TranslateProvider[] {
  const providers: TranslateProvider[] = [];

  if (setup.libreTranslateUrl) {
    providers.push(
      createLibreTranslateProvider({
        url: setup.libreTranslateUrl,
        ...(setup.libreTranslateApiKey ? { apiKey: setup.libreTranslateApiKey } : {}),
      }),
    );
  }

  providers.push(
    createMyMemoryProvider(setup.myMemoryEmail ? { email: setup.myMemoryEmail } : {}),
  );

  if (setup.enableGoogleGtx) {
    providers.push(createGoogleGtxProvider({ enabled: true }));
  }

  return providers;
}

/** Read the setup out of the environment, for the Next route handlers. */
export function translateSetupFromEnv(env: Record<string, string | undefined>): TranslateSetup {
  const setup: TranslateSetup = {};
  if (env.LIBRETRANSLATE_URL) setup.libreTranslateUrl = env.LIBRETRANSLATE_URL;
  if (env.LIBRETRANSLATE_API_KEY) setup.libreTranslateApiKey = env.LIBRETRANSLATE_API_KEY;
  if (env.MYMEMORY_EMAIL) setup.myMemoryEmail = env.MYMEMORY_EMAIL;
  if (env.WAKARU_ENABLE_GTX === "true" || env.WAKARU_ENABLE_GTX === "1") setup.enableGoogleGtx = true;
  return setup;
}

export function createTranslateChain(setup: TranslateSetup = {}): TranslateChain {
  return new TranslateChain({ providers: createTranslateProviders(setup) });
}
