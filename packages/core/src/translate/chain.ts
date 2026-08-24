import { ProviderError } from "../types";
import type { Attribution, LangCode, TranslateProvider, TranslationRequest, TranslationResult } from "../types";
import { Lru } from "../util/lru";
import { applyDialect, getDialect, providerLocaleFor } from "../dialects/index";
import { scriptOf } from "../languages/index";

/**
 * How many consecutive failures put a provider on the bench, and for how long.
 * Free endpoints go down regularly, and hammering one that is already refusing
 * requests only makes the user wait longer for the fallback.
 */
const TRIP_AFTER = 3;
const COOLDOWN_MS = 60_000;

interface Health {
  consecutiveFailures: number;
  benchedUntil: number;
  lastError?: string;
}

export interface TranslateChainOptions {
  providers: TranslateProvider[];
  cache?: Lru<TranslationResult>;
}

export interface ChainTranslateRequest extends TranslationRequest {
  /**
   * A dialect tag such as es-MX. The chain sends the base language upstream
   * unless the provider is known to understand the region, then applies the
   * dialect overlay to whatever comes back.
   */
  targetDialect?: LangCode;
}

export class TranslateChain {
  private readonly providers: TranslateProvider[];
  private readonly cache: Lru<TranslationResult>;
  private readonly health = new Map<string, Health>();

  constructor(options: TranslateChainOptions) {
    this.providers = options.providers;
    this.cache = options.cache ?? new Lru<TranslationResult>(800);
  }

  /** Provider status, surfaced on the status page and in the response header. */
  report(): { id: string; label: string; ready: boolean; benched: boolean; lastError?: string }[] {
    return this.providers.map((provider) => {
      const health = this.health.get(provider.id);
      const benched = Boolean(health && health.benchedUntil > Date.now());
      return {
        id: provider.id,
        label: provider.label,
        ready: provider.ready,
        benched,
        ...(health?.lastError ? { lastError: health.lastError } : {}),
      };
    });
  }

  private available(from: LangCode | "auto", to: LangCode): TranslateProvider[] {
    const now = Date.now();
    return this.providers.filter((provider) => {
      if (!provider.ready) return false;
      if (!provider.supports(from, to)) return false;
      const health = this.health.get(provider.id);
      return !health || health.benchedUntil <= now;
    });
  }

  private recordSuccess(id: string): void {
    this.health.set(id, { consecutiveFailures: 0, benchedUntil: 0 });
  }

  private recordFailure(id: string, error: unknown): void {
    const previous = this.health.get(id) ?? { consecutiveFailures: 0, benchedUntil: 0 };
    const failures = previous.consecutiveFailures + 1;
    const message = error instanceof Error ? error.message : String(error);

    // A rate limit is a hard stop until the budget resets, not a flaky call.
    const isQuota = error instanceof ProviderError && error.kind === "rate_limit";
    const benchedUntil =
      isQuota || failures >= TRIP_AFTER ? Date.now() + (isQuota ? COOLDOWN_MS * 15 : COOLDOWN_MS) : 0;

    this.health.set(id, { consecutiveFailures: failures, benchedUntil, lastError: message });
  }

  private key(from: string, to: string, text: string): string {
    return `${from}>${to}:${text}`;
  }

  async translate(req: ChainTranslateRequest, signal?: AbortSignal): Promise<TranslationResult> {
    const text = req.text.trim();
    if (!text) {
      throw new ProviderError("chain", "unsupported", "nothing to translate");
    }

    const dialect = req.targetDialect ? getDialect(req.targetDialect) : undefined;

    // Send upstream whatever the provider will actually accept.
    const upstreamTo = dialect ? providerLocaleFor(dialect.code) : req.to;
    const upstreamFrom = req.from === "auto" ? "auto" : providerLocaleFor(req.from);

    const cacheKey = this.key(upstreamFrom, req.targetDialect ?? upstreamTo, text);
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const candidates = this.available(upstreamFrom, upstreamTo);
    if (candidates.length === 0) {
      throw new ProviderError("chain", "unsupported", `no provider is available for ${upstreamFrom} to ${upstreamTo}`);
    }

    const fellBackFrom: string[] = [];
    let lastError: unknown;

    for (const provider of candidates) {
      try {
        const raw = await provider.translate({ text, from: upstreamFrom, to: upstreamTo }, signal);
        this.recordSuccess(provider.id);

        const attribution: Attribution[] = [provider.attribution];
        let finalText = raw.text;
        let dialectEdits: TranslationResult["dialectEdits"] = [];
        let lossyNote: string | undefined;

        if (dialect) {
          const script = dialect.script ?? scriptOf(dialect.base);
          const applied = applyDialect(raw.text, dialect.code, script);
          finalText = applied.text;
          dialectEdits = applied.edits;
          lossyNote = applied.lossyNote;
          attribution.push({
            source: `Wakaru dialect overlay, ${dialect.name}`,
            license: "MIT",
            url: "https://github.com/Abudora-0/Wakaru#dialects",
          });
        }

        const result: TranslationResult = {
          ...raw,
          text: finalText,
          from: raw.detectedFrom ?? (upstreamFrom === "auto" ? "auto" : upstreamFrom),
          to: req.targetDialect ?? req.to,
          provider: provider.id,
          fellBackFrom: [...fellBackFrom],
          dialectEdits,
          ...(lossyNote ? { lossyNote } : {}),
          cached: false,
          attribution,
        };

        this.cache.set(cacheKey, result);
        return result;
      } catch (error) {
        // A cancelled request is the user's doing, so stop rather than
        // burning the remaining providers on work nobody is waiting for.
        if (signal?.aborted) throw error;

        this.recordFailure(provider.id, error);
        fellBackFrom.push(provider.id);
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new ProviderError("chain", "network", "every provider failed");
  }
}
