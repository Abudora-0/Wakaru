import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TranslateChain } from "./chain";
import { ProviderError, type ProviderTranslation, type TranslateProvider, type TranslationRequest } from "../types";

/**
 * The chain is the part of the system that makes a pile of unreliable free
 * endpoints behave like one dependable service, and until now it was only
 * exercised by the live tests. That meant a regression in the fallback order
 * or the circuit breaker would pass CI and only show up in production, as
 * slow requests against an endpoint that is already refusing them.
 *
 * Everything here runs against fake providers, so no network and no quota.
 */

interface FakeOptions {
  id: string;
  ready?: boolean;
  supports?: (from: string, to: string) => boolean;
  /** Return a string to succeed, or throw to fail. */
  answer?: (req: TranslationRequest) => ProviderTranslation | never;
}

function fakeProvider(options: FakeOptions): TranslateProvider & { calls: TranslationRequest[] } {
  const calls: TranslationRequest[] = [];

  return {
    calls,
    id: options.id,
    label: options.id,
    ready: options.ready ?? true,
    dailyCharBudget: null,
    attribution: { source: options.id, license: "test", url: "https://example.test" },
    supports: (from, to) => (options.supports ? options.supports(from, to) : from !== to),
    async translate(req) {
      calls.push(req);
      if (!options.answer) return { text: `[${options.id}] ${req.text}` };
      return options.answer(req);
    },
  };
}

const failing = (id: string, kind: "network" | "rate_limit" = "network") =>
  fakeProvider({
    id,
    answer: () => {
      throw new ProviderError(id, kind, "deliberate test failure");
    },
  });

describe("provider selection", () => {
  it("uses the first provider that is ready and supports the pair", async () => {
    const first = fakeProvider({ id: "first" });
    const second = fakeProvider({ id: "second" });
    const chain = new TranslateChain({ providers: [first, second] });

    const result = await chain.translate({ text: "hello", from: "en", to: "es" });

    expect(result.provider).toBe("first");
    expect(result.text).toBe("[first] hello");
    expect(second.calls).toHaveLength(0);
  });

  it("skips a provider that is not configured", async () => {
    const unconfigured = fakeProvider({ id: "unconfigured", ready: false });
    const usable = fakeProvider({ id: "usable" });
    const chain = new TranslateChain({ providers: [unconfigured, usable] });

    const result = await chain.translate({ text: "hello", from: "en", to: "es" });

    expect(result.provider).toBe("usable");
    expect(unconfigured.calls).toHaveLength(0);
  });

  it("skips a provider that does not handle the pair", async () => {
    const englishOnly = fakeProvider({ id: "english-only", supports: (_from, to) => to === "en" });
    const general = fakeProvider({ id: "general" });
    const chain = new TranslateChain({ providers: [englishOnly, general] });

    const result = await chain.translate({ text: "hello", from: "en", to: "ja" });

    expect(result.provider).toBe("general");
    expect(englishOnly.calls).toHaveLength(0);
  });

  it("refuses when no provider can serve the pair", async () => {
    const chain = new TranslateChain({ providers: [fakeProvider({ id: "none", supports: () => false })] });
    await expect(chain.translate({ text: "hello", from: "en", to: "es" })).rejects.toThrow(/no provider/i);
  });

  it("refuses empty input before touching a provider", async () => {
    const provider = fakeProvider({ id: "p" });
    const chain = new TranslateChain({ providers: [provider] });

    await expect(chain.translate({ text: "   ", from: "en", to: "es" })).rejects.toThrow(ProviderError);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("fallback", () => {
  it("moves to the next provider when one fails, and records what it fell back from", async () => {
    const broken = failing("broken");
    const backup = fakeProvider({ id: "backup" });
    const chain = new TranslateChain({ providers: [broken, backup] });

    const result = await chain.translate({ text: "hello", from: "en", to: "es" });

    expect(result.provider).toBe("backup");
    expect(result.fellBackFrom).toEqual(["broken"]);
  });

  it("walks the whole chain before giving up", async () => {
    const chain = new TranslateChain({ providers: [failing("a"), failing("b"), fakeProvider({ id: "c" })] });
    const result = await chain.translate({ text: "hello", from: "en", to: "es" });

    expect(result.provider).toBe("c");
    expect(result.fellBackFrom).toEqual(["a", "b"]);
  });

  it("surfaces the last error when every provider fails", async () => {
    const chain = new TranslateChain({ providers: [failing("a"), failing("b")] });
    await expect(chain.translate({ text: "hello", from: "en", to: "es" })).rejects.toThrow(ProviderError);
  });

  it("stops immediately when the caller aborts, rather than burning the rest of the chain", async () => {
    const controller = new AbortController();
    const first = fakeProvider({
      id: "first",
      answer: () => {
        controller.abort();
        throw new ProviderError("first", "network", "aborted mid flight");
      },
    });
    const second = fakeProvider({ id: "second" });
    const chain = new TranslateChain({ providers: [first, second] });

    await expect(
      chain.translate({ text: "hello", from: "en", to: "es" }, controller.signal),
    ).rejects.toThrow();

    // Nobody is waiting for the answer, so the fallback must not run.
    expect(second.calls).toHaveLength(0);
  });
});

describe("circuit breaker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("benches a provider after three consecutive failures", async () => {
    const broken = failing("broken");
    const backup = fakeProvider({ id: "backup" });
    const chain = new TranslateChain({ providers: [broken, backup] });

    // Each call is a separate attempt, so three calls trip the breaker.
    for (let i = 0; i < 3; i++) {
      await chain.translate({ text: `attempt ${i}`, from: "en", to: "es" });
    }
    expect(broken.calls).toHaveLength(3);

    const afterTrip = await chain.translate({ text: "fourth", from: "en", to: "es" });

    // The broken provider is no longer tried at all, so nothing fell back.
    expect(broken.calls).toHaveLength(3);
    expect(afterTrip.fellBackFrom).toEqual([]);
    expect(afterTrip.provider).toBe("backup");
  });

  it("benches a rate limited provider immediately, without three strikes", async () => {
    const throttled = failing("throttled", "rate_limit");
    const backup = fakeProvider({ id: "backup" });
    const chain = new TranslateChain({ providers: [throttled, backup] });

    await chain.translate({ text: "first", from: "en", to: "es" });
    expect(throttled.calls).toHaveLength(1);

    // A quota refusal is a hard stop until the budget resets, not a flaky call.
    await chain.translate({ text: "second", from: "en", to: "es" });
    expect(throttled.calls).toHaveLength(1);
  });

  it("lets a benched provider back in once the cooldown passes", async () => {
    const flaky = failing("flaky");
    const backup = fakeProvider({ id: "backup" });
    const chain = new TranslateChain({ providers: [flaky, backup] });

    for (let i = 0; i < 3; i++) {
      await chain.translate({ text: `attempt ${i}`, from: "en", to: "es" });
    }
    expect(chain.report().find((p) => p.id === "flaky")?.benched).toBe(true);

    vi.advanceTimersByTime(61_000);

    expect(chain.report().find((p) => p.id === "flaky")?.benched).toBe(false);
    await chain.translate({ text: "after cooldown", from: "en", to: "es" });
    expect(flaky.calls).toHaveLength(4);
  });

  it("keeps a rate limited provider out far longer than a flaky one", async () => {
    const throttled = failing("throttled", "rate_limit");
    const chain = new TranslateChain({ providers: [throttled, fakeProvider({ id: "backup" })] });

    await chain.translate({ text: "first", from: "en", to: "es" });

    vi.advanceTimersByTime(61_000);
    expect(chain.report().find((p) => p.id === "throttled")?.benched).toBe(true);

    vi.advanceTimersByTime(15 * 60_000);
    expect(chain.report().find((p) => p.id === "throttled")?.benched).toBe(false);
  });

  it("forgets the failure count after a success", async () => {
    let shouldFail = true;
    const intermittent = fakeProvider({
      id: "intermittent",
      answer: (req) => {
        if (shouldFail) throw new ProviderError("intermittent", "network", "down");
        return { text: `ok ${req.text}` };
      },
    });
    const chain = new TranslateChain({ providers: [intermittent, fakeProvider({ id: "backup" })] });

    await chain.translate({ text: "one", from: "en", to: "es" });
    await chain.translate({ text: "two", from: "en", to: "es" });

    shouldFail = false;
    await chain.translate({ text: "three", from: "en", to: "es" });

    // The counter reset, so two more failures must not be enough to bench it.
    shouldFail = true;
    await chain.translate({ text: "four", from: "en", to: "es" });
    await chain.translate({ text: "five", from: "en", to: "es" });

    expect(chain.report().find((p) => p.id === "intermittent")?.benched).toBe(false);
  });

  it("reports the last error so an operator can see why", async () => {
    const chain = new TranslateChain({ providers: [failing("broken"), fakeProvider({ id: "backup" })] });
    await chain.translate({ text: "hello", from: "en", to: "es" });

    const entry = chain.report().find((p) => p.id === "broken");
    expect(entry?.lastError).toContain("deliberate test failure");
  });

  it("lists every provider with its configured state", () => {
    const chain = new TranslateChain({
      providers: [fakeProvider({ id: "ready-one" }), fakeProvider({ id: "not-set-up", ready: false })],
    });

    expect(chain.report()).toEqual([
      { id: "ready-one", label: "ready-one", ready: true, benched: false },
      { id: "not-set-up", label: "not-set-up", ready: false, benched: false },
    ]);
  });
});

/** Returns the input unchanged, so assertions can focus on the dialect layer. */
const echo = (id = "echo") => fakeProvider({ id, answer: (req) => ({ text: req.text }) });

describe("caching", () => {
  it("serves an identical request from cache without calling the provider again", async () => {
    const provider = echo();
    const chain = new TranslateChain({ providers: [provider] });

    const first = await chain.translate({ text: "hello", from: "en", to: "es" });
    const second = await chain.translate({ text: "hello", from: "en", to: "es" });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
    expect(provider.calls).toHaveLength(1);
  });

  it("treats different text as a different entry", async () => {
    const provider = echo();
    const chain = new TranslateChain({ providers: [provider] });

    await chain.translate({ text: "hello", from: "en", to: "es" });
    await chain.translate({ text: "goodbye", from: "en", to: "es" });

    expect(provider.calls).toHaveLength(2);
  });

  it("treats a different target as a different entry", async () => {
    const provider = echo();
    const chain = new TranslateChain({ providers: [provider] });

    await chain.translate({ text: "hello", from: "en", to: "es" });
    await chain.translate({ text: "hello", from: "en", to: "ja" });

    expect(provider.calls).toHaveLength(2);
  });

  it("keys the cache on the dialect, not just the base language", async () => {
    const provider = echo();
    const chain = new TranslateChain({ providers: [provider] });

    // Both go upstream as plain Spanish, but they must not share a cache
    // entry: the overlay applied afterwards is different for each.
    await chain.translate({ text: "el ordenador", from: "en", to: "es", targetDialect: "es-MX" });
    const peninsular = await chain.translate({ text: "el ordenador", from: "en", to: "es", targetDialect: "es-ES" });

    expect(peninsular.cached).toBe(false);
    expect(peninsular.text).toBe("el ordenador");
  });
});

describe("the dialect layer", () => {
  it("rewrites the result and records every edit", async () => {
    const chain = new TranslateChain({ providers: [echo()] });
    const result = await chain.translate({
      text: "Necesito un ordenador",
      from: "en",
      to: "es",
      targetDialect: "es-MX",
    });

    expect(result.text).toBe("Necesito un computadora");
    expect(result.dialectEdits).toHaveLength(1);
    expect(result.dialectEdits[0]).toMatchObject({ from: "ordenador", to: "computadora" });
  });

  it("reports the dialect as the target, not the base language", async () => {
    const chain = new TranslateChain({ providers: [echo()] });
    const result = await chain.translate({ text: "hola", from: "en", to: "es", targetDialect: "es-MX" });
    expect(result.to).toBe("es-MX");
  });

  it("credits the overlay alongside the provider", async () => {
    const chain = new TranslateChain({ providers: [echo()] });
    const result = await chain.translate({ text: "el ordenador", from: "en", to: "es", targetDialect: "es-MX" });

    expect(result.attribution).toHaveLength(2);
    expect(result.attribution[1]?.source).toContain("Mexican Spanish");
  });

  it("passes a region subtag upstream only when the provider understands it", async () => {
    const provider = echo();
    const chain = new TranslateChain({ providers: [provider] });

    await chain.translate({ text: "one", from: "en", to: "pt", targetDialect: "pt-BR" });
    // Kansai declares no provider locale, so the base language goes upstream.
    await chain.translate({ text: "two", from: "en", to: "ja", targetDialect: "ja-Kansai" });

    expect(provider.calls[0]?.to).toBe("pt-BR");
    expect(provider.calls[1]?.to).toBe("ja");
  });

  it("warns when a script conversion discards information", async () => {
    const chain = new TranslateChain({ providers: [echo()] });
    const result = await chain.translate({
      text: "ਪਿਆਰ",
      from: "en",
      to: "pa",
      targetDialect: "pa-Arab",
    });

    expect(result.text).toBe("پیار");
    expect(result.lossyNote).toContain("short vowels");
  });

  it("leaves the result untouched and sets no note without a dialect", async () => {
    const chain = new TranslateChain({ providers: [echo()] });
    const result = await chain.translate({ text: "el ordenador", from: "en", to: "es" });

    expect(result.text).toBe("el ordenador");
    expect(result.dialectEdits).toEqual([]);
    expect(result.lossyNote).toBeUndefined();
    expect(result.attribution).toHaveLength(1);
  });
});
