import { describe, expect, it } from "vitest";
import { applyDialect, baseOf, dialectsFor, getDialect, providerLocaleFor, ttsLocalesFor } from "./index";
import { transliterate } from "./translit";

describe("dialect registry", () => {
  it("resolves a dialect back to its base language", () => {
    expect(baseOf("es-MX")).toBe("es");
    expect(baseOf("pa-Arab")).toBe("pa");
    expect(baseOf("ja")).toBe("ja");
    expect(baseOf("xx-YY")).toBe("xx");
  });

  it("only passes a region subtag upstream when a provider understands it", () => {
    expect(providerLocaleFor("pt-BR")).toBe("pt-BR");
    // Kansai has no provider locale, so the base language goes upstream.
    expect(providerLocaleFor("ja-Kansai")).toBe("ja");
  });

  it("offers voice locales most specific first", () => {
    expect(ttsLocalesFor("es-MX")[0]).toBe("es-MX");
    expect(ttsLocalesFor("es-MX")).toContain("es");
  });

  it("groups dialects under their base", () => {
    const spanish = dialectsFor("es").map((d) => d.code);
    expect(spanish).toContain("es-MX");
    expect(spanish).toContain("es-AR");
    expect(dialectsFor("qqq")).toHaveLength(0);
  });
});

describe("lexicon overlay", () => {
  it("rewrites peninsular vocabulary for Mexico and reports every edit", () => {
    const result = applyDialect("Necesito un ordenador y un coche.", "es-MX");
    expect(result.text).toBe("Necesito un computadora y un carro.");
    expect(result.edits).toHaveLength(2);
    expect(result.edits[0]?.confidence).toBe("high");
  });

  it("preserves the casing of the word it replaced", () => {
    const result = applyDialect("Ordenador nuevo", "es-MX");
    expect(result.text).toBe("Computadora nuevo");
  });

  it("does not rewrite a word that merely contains the term", () => {
    // "papa" must not be found inside "papaya".
    const result = applyDialect("Comi una papaya entera", "es-ES");
    expect(result.text).toBe("Comi una papaya entera");
    expect(result.edits).toHaveLength(0);
  });

  it("respects accented letters as word characters", () => {
    // The ASCII word boundary would treat the accent as a break.
    const result = applyDialect("el móvil", "es-MX");
    expect(result.text).toBe("el celular");
  });

  it("applies orthography rules before vocabulary", () => {
    const result = applyDialect("The colour of the centre", "en-US");
    expect(result.text).toBe("The color of the center");
  });

  it("matches inside unspaced scripts without a boundary check", () => {
    const result = applyDialect("我要坐出租车", "zh-Hant-HK");
    expect(result.text).toContain("的士");
  });

  it("prefers the longest term when two overlap", () => {
    const result = applyDialect("Quero pequeno-almoço", "pt-BR");
    expect(result.text).toBe("Quero café da manhã");
  });

  it("returns the input untouched for an unknown dialect", () => {
    const result = applyDialect("unchanged", "zz-ZZ");
    expect(result.text).toBe("unchanged");
    expect(result.edits).toHaveLength(0);
  });
});

describe("transliteration", () => {
  it("maps Serbian Cyrillic to Latin exactly, digraphs included", () => {
    expect(transliterate("Његош", "serbian-cyrl-to-latn")).toBe("Njegoš");
    expect(transliterate("џем", "serbian-cyrl-to-latn")).toBe("džem");
    expect(transliterate("Београд", "serbian-cyrl-to-latn")).toBe("Beograd");
  });

  it("keeps characters it has no rule for", () => {
    expect(transliterate("Београд 2026", "serbian-cyrl-to-latn")).toBe("Beograd 2026");
  });

  it("converts Gurmukhi to Shahmukhi and flags the loss", () => {
    const result = applyDialect("ਪੰਜਾਬੀ", "pa-Arab");
    expect(result.text).not.toContain("ਪ");
    expect(result.lossyNote).toBeTruthy();
  });

  it("romanises Devanagari for Hinglish", () => {
    expect(transliterate("नमस्ते", "devanagari-to-latin")).toBe("namaste");
  });

it("inserts the inherent vowel and drops it at the end of a word", () => {
    // कमल is kamal, not kamala: Hindi deletes the final inherent vowel.
    expect(transliterate("कमल", "devanagari-to-latin")).toBe("kamal");
    // The virama joins a cluster with no vowel between the consonants.
    expect(transliterate("क्षमा", "devanagari-to-latin")).toBe("kshamaa");
    expect(transliterate("हिन्दी", "devanagari-to-latin")).toBe("hindee");
  });

  it("leaves Latin text and digits alone", () => {
    expect(transliterate("नमस्ते 2026 ok", "devanagari-to-latin")).toBe("namaste 2026 ok");
  });

  it("returns the input when the rule set does not exist", () => {
    expect(transliterate("abc", "no-such-rules")).toBe("abc");
  });
});
