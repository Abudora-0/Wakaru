import { ProviderError } from "../types";
import type { ProviderTranslation, TranslateProvider, TranslationRequest } from "../types";
import { fetchJson } from "../util/http";

interface MyMemoryResponse {
  responseData?: { translatedText?: string; match?: number };
  responseStatus?: number | string;
  responseDetails?: string;
  quotaFinished?: boolean;
  matches?: { translation?: string; quality?: string | number; match?: number }[];
}

/** The free tier rejects anything longer than roughly 500 bytes per call. */
const SEGMENT_LIMIT = 480;

/**
 * MyMemory returns its quota and configuration failures inside a normal 200
 * response, with the error text sitting in the translatedText field. Those
 * have to be caught here or they would be rendered to the user as if they
 * were a translation.
 */
const ERROR_MARKERS = [
  "MYMEMORY WARNING",
  "QUERY LENGTH LIMIT",
  "YOU USED ALL AVAILABLE FREE TRANSLATIONS",
  "PLEASE SELECT TWO DISTINCT LANGUAGES",
  "INVALID LANGUAGE PAIR",
  "AN ERROR OCCURRED",
];

/**
 * Split on sentence endings so a long paragraph still fits the per call limit.
 * Falls back to a hard character split for text with no sentence punctuation,
 * which is common in Chinese and Japanese.
 */
export function segmentText(text: string, limit = SEGMENT_LIMIT): string[] {
  if (text.length <= limit) return [text];

  const pieces = text.split(/(?<=[.!?。！？\n])\s*/);
  const segments: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (piece.length > limit) {
      if (current) {
        segments.push(current);
        current = "";
      }
      for (let i = 0; i < piece.length; i += limit) {
        segments.push(piece.slice(i, i + limit));
      }
      continue;
    }
    if ((current + piece).length > limit) {
      segments.push(current);
      current = piece;
    } else {
      current += piece;
    }
  }

  if (current) segments.push(current);
  return segments.filter((s) => s.length > 0);
}

export interface MyMemoryOptions {
  /**
   * An operator email lifts the anonymous daily budget from 5,000 characters
   * to 50,000. It is sent to MyMemory only, and only when configured.
   */
  email?: string;
  endpoint?: string;
}

export function createMyMemoryProvider(options: MyMemoryOptions = {}): TranslateProvider {
  const endpoint = options.endpoint ?? "https://api.mymemory.translated.net/get";
  const id = "mymemory";

  return {
    id,
    label: "MyMemory",
    ready: true,
    dailyCharBudget: options.email ? 50_000 : 5_000,
    attribution: {
      source: "MyMemory Translation Memory",
      license: "Free tier, attribution requested",
      url: "https://mymemory.translated.net",
    },

    supports(from, to) {
      // MyMemory needs a concrete pair, so automatic detection is out.
      return from !== "auto" && from !== to;
    },

    async translate(req: TranslationRequest, signal?: AbortSignal): Promise<ProviderTranslation> {
      if (req.from === "auto") {
        throw new ProviderError(id, "unsupported", "this provider cannot detect the source language");
      }

      const segments = segmentText(req.text);
      const translated: string[] = [];
      let worstMatch = 1;

      for (const segment of segments) {
        const url = new URL(endpoint);
        url.searchParams.set("q", segment);
        url.searchParams.set("langpair", `${req.from}|${req.to}`);
        if (options.email) url.searchParams.set("de", options.email);

        const data = await fetchJson<MyMemoryResponse>(url.toString(), { provider: id, signal });

        if (data.quotaFinished) {
          throw new ProviderError(id, "rate_limit", "daily character budget exhausted");
        }

        const text = data.responseData?.translatedText ?? "";
        const upper = text.toUpperCase();
        if (ERROR_MARKERS.some((marker) => upper.includes(marker))) {
          const kind = upper.includes("FREE TRANSLATIONS") ? "rate_limit" : "bad_response";
          throw new ProviderError(id, kind, data.responseDetails || text);
        }
        if (!text.trim()) {
          throw new ProviderError(id, "bad_response", "empty translation");
        }

        translated.push(text);
        worstMatch = Math.min(worstMatch, data.responseData?.match ?? 1);
      }

      return {
        text: translated.join(" ").trim(),
        match: worstMatch,
      };
    },
  };
}
