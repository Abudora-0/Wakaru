import type { Page } from "@playwright/test";

/**
 * Canned provider responses.
 *
 * Shapes match what the route handlers really return, so a change to the
 * response contract breaks these specs rather than silently passing.
 */

export const SPANISH_MEXICAN = {
  text: "Necesito una computadora y un carro.",
  match: 0.9,
  from: "en",
  to: "es-MX",
  provider: "mymemory",
  fellBackFrom: [],
  dialectEdits: [
    { from: "auto", to: "carro", confidence: "medium", note: "auto is Rioplatense, Mexico says carro" },
  ],
  cached: false,
  attribution: [
    { source: "MyMemory Translation Memory", license: "Free tier", url: "https://mymemory.translated.net" },
    { source: "Wakaru dialect overlay, Mexican Spanish", license: "MIT", url: "https://example.test" },
  ],
};

export const JAPANESE_PLAIN = {
  text: "おはようございます",
  from: "en",
  to: "ja",
  provider: "mymemory",
  fellBackFrom: [],
  dialectEdits: [],
  cached: false,
  attribution: [{ source: "MyMemory Translation Memory", license: "Free tier", url: "https://mymemory.translated.net" }],
};

export const AFTER_FALLBACK = {
  ...JAPANESE_PLAIN,
  provider: "libretranslate",
  fellBackFrom: ["mymemory"],
};

export const SHAHMUKHI = {
  text: "پیار",
  from: "en",
  to: "pa-Arab",
  provider: "mymemory",
  fellBackFrom: [],
  dialectEdits: [],
  lossyNote: "Shahmukhi does not write short vowels, so the result is readable but not a perfect record.",
  cached: false,
  attribution: [{ source: "MyMemory Translation Memory", license: "Free tier", url: "https://mymemory.translated.net" }],
};

/** Answer /api/translate with a fixed payload, and record what was asked. */
export async function mockTranslate(page: Page, payload: unknown, status = 200) {
  const requests: Record<string, unknown>[] = [];

  await page.route("**/api/translate", async (route) => {
    requests.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });

  return requests;
}
