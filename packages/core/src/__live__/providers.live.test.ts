import { describe, expect, it } from "vitest";
import { createTranslateChain } from "../translate/index";
import { createDictionaryChain } from "../dictionary/index";
import { findLanguagesForWord } from "../dictionary/wiktionary";

/**
 * Live checks against the real free endpoints.
 *
 * These are excluded from the default test run. They exist to answer one
 * question that mocked tests cannot: are the free providers still up and still
 * shaped the way this code expects.
 */

const TIMEOUT = 30_000;

describe("translate chain, live", () => {
  it("translates through the default free provider", async () => {
    const chain = createTranslateChain({});
    const result = await chain.translate({ text: "Where is the library?", from: "en", to: "es" });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.provider).toBe("mymemory");
    console.log("  en to es:", result.text, "via", result.provider);
  }, TIMEOUT);

  it("applies the dialect overlay on top of a real translation", async () => {
    const chain = createTranslateChain({});
    const result = await chain.translate({
      text: "I need a computer and a car.",
      from: "en",
      to: "es",
      targetDialect: "es-MX",
    });

    expect(result.to).toBe("es-MX");
    console.log("  en to es-MX:", result.text, "| edits:", JSON.stringify(result.dialectEdits));
  }, TIMEOUT);

  it("serves the second identical request from cache", async () => {
    const chain = createTranslateChain({});
    const first = await chain.translate({ text: "Good morning", from: "en", to: "ja" });
    const second = await chain.translate({ text: "Good morning", from: "en", to: "ja" });

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.text).toBe(first.text);
    console.log("  en to ja:", first.text);
  }, TIMEOUT);
});

describe("dictionary chain, live", () => {
  it("builds a full English entry with audio and synonyms", async () => {
    const chain = createDictionaryChain();
    const entry = await chain.lookup("serendipity", "en");

    expect(entry).not.toBeNull();
    expect(entry!.senses.length).toBeGreaterThan(0);
    expect(entry!.pronunciations.some((p) => p.ipa)).toBe(true);
    expect(entry!.pronunciations.some((p) => p.audioUrl)).toBe(true);
    expect(entry!.attribution.length).toBeGreaterThan(0);

    console.log("  serendipity:", entry!.senses.length, "senses,",
      entry!.pronunciations.length, "pronunciations,",
      entry!.synonyms.length, "synonyms, sources:", entry!.sources.join(", "));
  }, TIMEOUT);

  it("builds a Japanese entry from Wiktionary", async () => {
    const chain = createDictionaryChain();
    const entry = await chain.lookup("猫", "ja");

    expect(entry).not.toBeNull();
    expect(entry!.senses.length).toBeGreaterThan(0);
    expect(entry!.script).toBe("Jpan");
    console.log("  neko:", entry!.senses[0]?.definition);
  }, TIMEOUT);

  it("finds human recordings for a non English word", async () => {
    const chain = createDictionaryChain();
    const entry = await chain.lookup("eau", "fr");

    expect(entry).not.toBeNull();
    const audio = entry!.pronunciations.filter((p) => p.audioUrl);
    console.log("  eau:", audio.length, "recordings, first:", audio[0]?.audioUrl);
    expect(audio.length).toBeGreaterThan(0);
  }, TIMEOUT);

  it("marks a right to left entry correctly", async () => {
    const chain = createDictionaryChain();
    const entry = await chain.lookup("کتاب", "ur");
    if (entry) {
      expect(entry.dir).toBe("rtl");
      console.log("  kitab:", entry.senses[0]?.definition ?? "(no sense)");
    } else {
      console.log("  kitab: no Wiktionary entry, which is a valid outcome");
    }
  }, TIMEOUT);

  it("reports every language that spells a word the same way", async () => {
    const langs = await findLanguagesForWord("agua");
    expect(langs.length).toBeGreaterThan(1);
    console.log("  agua exists in:", langs.join(", "));
  }, TIMEOUT);
});
