import { ProviderError } from "../types.js";
import type { ProviderTranslation, TranslateProvider, TranslationRequest } from "../types.js";
import { fetchJson } from "../util/http.js";

interface LibreTranslateResponse {
  translatedText?: string;
  detectedLanguage?: { language?: string; confidence?: number };
  error?: string;
}

export interface LibreTranslateOptions {
  /** Base URL of a LibreTranslate instance, for example http://localhost:5000 */
  url?: string;
  /** Only needed by hosted instances. A self hosted instance needs nothing. */
  apiKey?: string;
}

/**
 * LibreTranslate, self hosted.
 *
 * The public instance at libretranslate.com began requiring an API key, so the
 * only genuinely free path is running it yourself. docker/libretranslate.yml
 * in this repository starts one with a single command. When LIBRETRANSLATE_URL
 * is set this provider takes priority over everything else, because it has no
 * quota, no third party and no terms to worry about.
 */
export function createLibreTranslateProvider(options: LibreTranslateOptions = {}): TranslateProvider {
  const id = "libretranslate";
  const url = options.url?.replace(/\/+$/, "");

  return {
    id,
    label: "LibreTranslate",
    ready: Boolean(url),
    dailyCharBudget: null,
    attribution: {
      source: "LibreTranslate",
      license: "AGPL-3.0, self hosted",
      url: "https://github.com/LibreTranslate/LibreTranslate",
    },

    supports(_from, to) {
      return Boolean(url) && Boolean(to);
    },

    async translate(req: TranslationRequest, signal?: AbortSignal): Promise<ProviderTranslation> {
      if (!url) {
        throw new ProviderError(id, "not_configured", "set LIBRETRANSLATE_URL to enable this provider");
      }

      const data = await fetchJson<LibreTranslateResponse>(`${url}/translate`, {
        provider: id,
        method: "POST",
        signal,
        body: {
          q: req.text,
          source: req.from === "auto" ? "auto" : req.from,
          target: req.to,
          format: "text",
          ...(options.apiKey ? { api_key: options.apiKey } : {}),
        },
      });

      if (data.error) {
        throw new ProviderError(id, "bad_response", data.error);
      }
      if (!data.translatedText?.trim()) {
        throw new ProviderError(id, "bad_response", "empty translation");
      }

      const detected = data.detectedLanguage?.language;
      return {
        text: data.translatedText,
        ...(detected ? { detectedFrom: detected } : {}),
      };
    },
  };
}

/** Ask a running instance which pairs it actually has models installed for. */
export async function fetchLibreTranslateLanguages(url: string, signal?: AbortSignal): Promise<string[]> {
  const clean = url.replace(/\/+$/, "");
  const data = await fetchJson<{ code: string }[]>(`${clean}/languages`, {
    provider: "libretranslate",
    signal,
  });
  return data.map((entry) => entry.code);
}
