import { afterEach, describe, expect, it, vi } from "vitest";
import { createLibreTranslateProvider } from "./libretranslate";
import { createGoogleGtxProvider } from "./google-gtx";
import { createTranslateProviders, translateSetupFromEnv } from "./index";
import { ProviderError } from "../types";

afterEach(() => vi.unstubAllGlobals());

function respondJson(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }) as unknown as Response),
  );
}

function respondText(body: string, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
    }) as unknown as Response),
  );
}

describe("LibreTranslate", () => {
  it("reports itself unready until a URL is configured", () => {
    expect(createLibreTranslateProvider().ready).toBe(false);
    expect(createLibreTranslateProvider({ url: "http://localhost:5000" }).ready).toBe(true);
  });

  it("refuses to run rather than guessing an endpoint", async () => {
    const error = await createLibreTranslateProvider()
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("not_configured");
  });

  it("has no daily budget, because it is your own machine", () => {
    expect(createLibreTranslateProvider({ url: "http://localhost:5000" }).dailyCharBudget).toBeNull();
  });

  it("returns the translation and the language it detected", async () => {
    respondJson({ translatedText: "hola", detectedLanguage: { language: "en", confidence: 98 } });
    const result = await createLibreTranslateProvider({ url: "http://localhost:5000" }).translate({
      text: "hello",
      from: "auto",
      to: "es",
    });

    expect(result.text).toBe("hola");
    expect(result.detectedFrom).toBe("en");
  });

  it("tolerates a trailing slash on the configured URL", async () => {
    const spy = vi.fn(async (_url: string, _options?: RequestInit) =>
      ({ ok: true, status: 200, json: async () => ({ translatedText: "hola" }) }) as unknown as Response);
    vi.stubGlobal("fetch", spy);

    await createLibreTranslateProvider({ url: "http://localhost:5000/" }).translate({
      text: "hello",
      from: "en",
      to: "es",
    });

    const [url] = spy.mock.calls[0] ?? [];
    expect(url).toBe("http://localhost:5000/translate");
  });

  it("treats an error field inside a 200 as a failure", async () => {
    respondJson({ error: "target language not installed" });
    const error = await createLibreTranslateProvider({ url: "http://localhost:5000" })
      .translate({ text: "hello", from: "en", to: "xx" })
      .catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("bad_response");
    expect((error as ProviderError).message).toContain("not installed");
  });

  it("refuses an empty translation", async () => {
    respondJson({ translatedText: "  " });
    await expect(
      createLibreTranslateProvider({ url: "http://localhost:5000" }).translate({ text: "hello", from: "en", to: "es" }),
    ).rejects.toThrow(ProviderError);
  });
});

describe("the unofficial Google endpoint", () => {
  /**
   * This provider is a deliberate trade off rather than a default, so the
   * assertion that matters most is simply that it stays switched off. A
   * change that flips this default should fail the build.
   */
  it("is disabled unless an operator turns it on", () => {
    const provider = createGoogleGtxProvider();
    expect(provider.ready).toBe(false);
    expect(provider.supports("en", "es")).toBe(false);
  });

  it("refuses to send anything while disabled", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    const error = await createGoogleGtxProvider()
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("not_configured");
    expect(spy).not.toHaveBeenCalled();
  });

  it("says plainly in its attribution that there are no terms covering this", () => {
    expect(createGoogleGtxProvider().attribution.license).toMatch(/no published terms/i);
  });

  it("joins the segments the endpoint splits long input into", async () => {
    respondText('[[["Hola mundo. ","Hello world. ",null,null,10],["Adios.","Goodbye.",null,null,3]],null,"en"]');
    const result = await createGoogleGtxProvider({ enabled: true }).translate({
      text: "Hello world. Goodbye.",
      from: "auto",
      to: "es",
    });

    expect(result.text).toBe("Hola mundo. Adios.");
    expect(result.detectedFrom).toBe("en");
  });

  it("rejects a response that is not the shape it expects", async () => {
    respondText("<html>blocked</html>");
    const error = await createGoogleGtxProvider({ enabled: true })
      .translate({ text: "hello", from: "en", to: "es" })
      .catch((e: unknown) => e);

    expect((error as ProviderError).kind).toBe("bad_response");
  });

  it("rejects a well formed response that carries no segments", async () => {
    respondText('[null,null,"en"]');
    await expect(
      createGoogleGtxProvider({ enabled: true }).translate({ text: "hello", from: "en", to: "es" }),
    ).rejects.toThrow(ProviderError);
  });
});

describe("chain assembly", () => {
  it("ships MyMemory alone by default, with nothing to configure", () => {
    expect(createTranslateProviders().map((p) => p.id)).toEqual(["mymemory"]);
  });

  it("puts a self hosted LibreTranslate ahead of MyMemory", () => {
    const ids = createTranslateProviders({ libreTranslateUrl: "http://localhost:5000" }).map((p) => p.id);
    expect(ids).toEqual(["libretranslate", "mymemory"]);
  });

  it("appends the unofficial endpoint last, and only when asked", () => {
    expect(createTranslateProviders({ enableGoogleGtx: true }).map((p) => p.id)).toEqual(["mymemory", "google-gtx"]);
  });

  it("reads configuration out of the environment", () => {
    const setup = translateSetupFromEnv({
      LIBRETRANSLATE_URL: "http://localhost:5000",
      MYMEMORY_EMAIL: "someone@example.com",
      WAKARU_ENABLE_GTX: "true",
    });

    expect(setup).toEqual({
      libreTranslateUrl: "http://localhost:5000",
      myMemoryEmail: "someone@example.com",
      enableGoogleGtx: true,
    });
  });

  it("leaves the unofficial endpoint off for any value other than a clear yes", () => {
    expect(translateSetupFromEnv({ WAKARU_ENABLE_GTX: "false" }).enableGoogleGtx).toBeUndefined();
    expect(translateSetupFromEnv({ WAKARU_ENABLE_GTX: "yes" }).enableGoogleGtx).toBeUndefined();
    expect(translateSetupFromEnv({}).enableGoogleGtx).toBeUndefined();
  });
});
