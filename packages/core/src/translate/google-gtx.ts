import { ProviderError } from "../types.js";
import type { ProviderTranslation, TranslateProvider, TranslationRequest } from "../types.js";
import { fetchText } from "../util/http.js";

/**
 * The undocumented endpoint that Google Translate's own web client calls.
 *
 * This is disabled by default and stays that way unless an operator sets
 * WAKARU_ENABLE_GTX. It is included because it is keyless, free and by far the
 * highest quality option available, but the trade off is real and is stated
 * plainly rather than buried:
 *
 *   1. It is undocumented, so it can change or disappear without notice.
 *   2. It is rate limited by IP address and will start refusing a busy server.
 *   3. It is not covered by any published terms of service for this use.
 *
 * The decision to turn it on belongs to whoever runs the deployment.
 */
export interface GoogleGtxOptions {
  enabled?: boolean;
  endpoint?: string;
}

type GtxPayload = [Array<[string, string, ...unknown[]]> | null, unknown, string | null, ...unknown[]];

export function createGoogleGtxProvider(options: GoogleGtxOptions = {}): TranslateProvider {
  const id = "google-gtx";
  const enabled = options.enabled ?? false;
  const endpoint = options.endpoint ?? "https://translate.googleapis.com/translate_a/single";

  return {
    id,
    label: "Google Translate, unofficial endpoint",
    ready: enabled,
    dailyCharBudget: null,
    attribution: {
      source: "Google Translate, undocumented web endpoint",
      license: "No published terms for this use, disabled by default",
      url: "https://translate.google.com",
    },

    supports(_from, to) {
      return enabled && Boolean(to);
    },

    async translate(req: TranslationRequest, signal?: AbortSignal): Promise<ProviderTranslation> {
      if (!enabled) {
        throw new ProviderError(id, "not_configured", "provider is disabled, set WAKARU_ENABLE_GTX to turn it on");
      }

      const url = new URL(endpoint);
      url.searchParams.set("client", "gtx");
      url.searchParams.set("sl", req.from === "auto" ? "auto" : req.from);
      url.searchParams.set("tl", req.to);
      url.searchParams.set("dt", "t");
      url.searchParams.set("q", req.text);

      const raw = await fetchText(url.toString(), { provider: id, signal });

      let payload: GtxPayload;
      try {
        payload = JSON.parse(raw) as GtxPayload;
      } catch {
        throw new ProviderError(id, "bad_response", "endpoint returned something other than the expected array");
      }

      const segments = payload[0];
      if (!Array.isArray(segments) || segments.length === 0) {
        throw new ProviderError(id, "bad_response", "no translated segments in response");
      }

      // The response splits long input into chunks, each with the translation
      // in position zero and the original in position one.
      const text = segments
        .map((segment) => (Array.isArray(segment) ? segment[0] : ""))
        .filter((piece): piece is string => typeof piece === "string")
        .join("");

      if (!text.trim()) {
        throw new ProviderError(id, "bad_response", "empty translation");
      }

      const detected = typeof payload[2] === "string" ? payload[2] : undefined;
      return {
        text,
        ...(detected ? { detectedFrom: detected } : {}),
      };
    },
  };
}
