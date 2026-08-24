import { afterEach, describe, expect, it, vi } from "vitest";
import { createMyMemoryProvider, segmentText } from "./mymemory";
import { ProviderError } from "../types";

/**
 * MyMemory reports its failures inside a normal 200 response, with the error
 * text sitting in the field that would otherwise hold the translation. If that
 * is not caught here it reaches the reader looking like a translation, which
 * is the single worst failure mode in the whole provider chain.
 */

const calls: string[] = [];

function mockJson(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
      } as unknown as Response;
    }),
  );
}

/** Answer each successive call with the next payload in the list. */
function mockSequence(payloads: unknown[]) {
  let index = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      const payload = payloads[Math.min(index++, payloads.length - 1)];
      return { ok: true, status: 200, json: async () => payload } as unknown as Response;
    }),
  );
}

const ok = (text: string, match = 1) => ({
  responseData: { translatedText: text, match },
  responseStatus: 200,
});

afterEach(() => {
  vi.unstubAllGlobals();
  calls.length = 0;
});

describe("segmentText", () => {
  it("leaves text that already fits as a single segment", () => {
    expect(segmentText("short enough", 480)).toEqual(["short enough"]);
  });

  it("splits on sentence endings rather than mid word", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const segments = segmentText(text, 20);

    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) expect(segment.length).toBeLessThanOrEqual(20);
    expect(segments.join(" ")).toContain("First sentence.");
  });

  it("understands CJK sentence punctuation", () => {
    const segments = segmentText("これは一つ目。これは二つ目。これは三つ目。", 12);
    expect(segments.length).toBeGreaterThan(1);
    for (const segment of segments) expect(segment.length).toBeLessThanOrEqual(12);
  });

  it("hard splits text that has no punctuation at all", () => {
    // Common in Chinese and Japanese, where a long run may carry no full stop.
    const segments = segmentText("x".repeat(1000), 400);
    expect(segments).toHaveLength(3);
    for (const segment of segments) expect(segment.length).toBeLessThanOrEqual(400);
    expect(segments.join("").length).toBe(1000);
  });

  it("never emits an empty segment", () => {
    for (const segment of segmentText("A. B. C. ".repeat(50), 30)) {
      expect(segment.length).toBeGreaterThan(0);
    }
  });
});

describe("MyMemory provider", () => {
  it("cannot detect a source language, so it declines auto", () => {
    const provider = createMyMemoryProvider();
    expect(provider.supports("auto", "es")).toBe(false);
    expect(provider.supports("en", "es")).toBe(true);
  });

  it("declines a pair with the same language on both sides", () => {
    expect(createMyMemoryProvider().supports("en", "en")).toBe(false);
  });

  it("returns the translation on the happy path", async () => {
    mockJson(ok("hola", 0.98));
    const result = await createMyMemoryProvider().translate({ text: "hello", from: "en", to: "es" });

    expect(result.text).toBe("hola");
    expect(result.match).toBe(0.98);
    expect(calls[0]).toContain("langpair=en%7Ces");
  });

  it("rejects an auto request rather than sending it", async () => {
    mockJson(ok("nope"));
    await expect(
      createMyMemoryProvider().translate({ text: "hello", from: "auto", to: "es" }),
    ).rejects.toThrow(ProviderError);
    expect(calls).toHaveLength(0);
  });

  it("treats the quota flag as a rate limit", async () => {
    mockJson({ ...ok("hola"), quotaFinished: true });

    const error = await createMyMemoryProvider()
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("rate_limit");
    expect((error as ProviderError).retryable).toBe(true);
  });

  it("catches the quota warning that arrives as the translation text", async () => {
    mockJson(ok("MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"));

    const error = await createMyMemoryProvider()
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).kind).toBe("rate_limit");
  });

  it("catches a configuration error delivered as the translation text", async () => {
    mockJson({
      ...ok("PLEASE SELECT TWO DISTINCT LANGUAGES"),
      responseDetails: "PLEASE SELECT TWO DISTINCT LANGUAGES",
    });

    const error = await createMyMemoryProvider()
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((err: unknown) => err);

    expect((error as ProviderError).kind).toBe("bad_response");
  });

  it("refuses an empty translation instead of returning a blank result", async () => {
    mockJson(ok("   "));
    await expect(
      createMyMemoryProvider().translate({ text: "hello", from: "en", to: "es" }),
    ).rejects.toThrow(ProviderError);
  });

  it("splits long input across calls and rejoins the answers", async () => {
    mockSequence([ok("uno"), ok("dos"), ok("tres")]);

    const long = `${"a".repeat(470)}. ${"b".repeat(470)}. ${"c".repeat(470)}.`;
    const result = await createMyMemoryProvider().translate({ text: long, from: "en", to: "es" });

    expect(calls).toHaveLength(3);
    expect(result.text).toBe("uno dos tres");
  });

  it("reports the worst segment confidence, not the best", async () => {
    mockSequence([ok("uno", 0.99), ok("dos", 0.4)]);

    const long = `${"a".repeat(470)}. ${"b".repeat(470)}.`;
    const result = await createMyMemoryProvider().translate({ text: long, from: "en", to: "es" });

    expect(result.match).toBe(0.4);
  });

  it("raises the daily budget and sends the address when an email is set", async () => {
    mockJson(ok("hola"));
    const provider = createMyMemoryProvider({ email: "someone@example.com" });

    expect(provider.dailyCharBudget).toBe(50_000);
    await provider.translate({ text: "hello", from: "en", to: "es" });
    expect(calls[0]).toContain("de=someone%40example.com");
  });

  it("uses the anonymous budget and sends no address by default", async () => {
    mockJson(ok("hola"));
    const provider = createMyMemoryProvider();

    expect(provider.dailyCharBudget).toBe(5_000);
    await provider.translate({ text: "hello", from: "en", to: "es" });
    expect(calls[0]).not.toContain("de=");
  });
});
