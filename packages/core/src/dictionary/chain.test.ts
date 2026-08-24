import { describe, expect, it } from "vitest";
import { DictionaryChain } from "./chain";
import { ProviderError, type DictionaryProvider, type Sense, type UnifiedEntry } from "../types";

/**
 * The dictionary chain behaves in the opposite way to the translation chain,
 * and the difference is easy to break by accident. Translation stops at the
 * first provider that answers. A dictionary entry is better as the union of
 * its sources, so this one queries everything that covers the language and
 * folds the answers together.
 *
 * Enrichment is switched off throughout, so nothing here touches the network.
 */

function sense(partOfSpeech: string, definition: string): Sense {
  return { partOfSpeech, definition, examples: [], synonyms: [], antonyms: [] };
}

interface FakeOptions {
  id: string;
  supports?: (lang: string) => boolean;
  entry?: Partial<UnifiedEntry> | null;
  fail?: boolean;
}

function fakeProvider(options: FakeOptions): DictionaryProvider & { calls: string[] } {
  const calls: string[] = [];

  return {
    calls,
    id: options.id,
    label: options.id,
    attribution: { source: options.id, license: "test", url: "https://example.test" },
    supports: (lang) => (options.supports ? options.supports(lang) : true),
    async lookup(word) {
      calls.push(word);
      if (options.fail) throw new ProviderError(options.id, "network", "deliberate test failure");
      return options.entry ?? null;
    },
  };
}

/** Enrichment reaches the network, so it is off in every test here. */
function chainOf(providers: DictionaryProvider[]) {
  return new DictionaryChain({ providers, enrichAudio: false, enrichEnglishRelated: false });
}

describe("merging", () => {
  it("combines senses from every provider that answered", async () => {
    const chain = chainOf([
      fakeProvider({ id: "a", entry: { senses: [sense("noun", "a small cat")] } }),
      fakeProvider({ id: "b", entry: { senses: [sense("verb", "to move quietly")] } }),
    ]);

    const entry = await chain.lookup("cat", "en");

    expect(entry?.senses).toHaveLength(2);
    expect(entry?.sources).toEqual(["a", "b"]);
  });

  it("queries every provider rather than stopping at the first answer", async () => {
    const first = fakeProvider({ id: "a", entry: { senses: [sense("noun", "one")] } });
    const second = fakeProvider({ id: "b", entry: { senses: [sense("noun", "two")] } });
    await chainOf([first, second]).lookup("word", "en");

    expect(first.calls).toEqual(["word"]);
    expect(second.calls).toEqual(["word"]);
  });

  it("drops a duplicate definition that two providers both carry", async () => {
    // dictionaryapi.dev is itself sourced from Wiktionary, so overlap between
    // the two is the normal case for English rather than an edge case.
    const chain = chainOf([
      fakeProvider({ id: "a", entry: { senses: [sense("noun", "A domesticated feline.")] } }),
      fakeProvider({ id: "b", entry: { senses: [sense("noun", "a domesticated feline")] } }),
    ]);

    const entry = await chain.lookup("cat", "en");
    expect(entry?.senses).toHaveLength(1);
  });

  it("keeps the same wording under a different part of speech", async () => {
    const chain = chainOf([
      fakeProvider({ id: "a", entry: { senses: [sense("noun", "run")] } }),
      fakeProvider({ id: "b", entry: { senses: [sense("verb", "run")] } }),
    ]);

    expect((await chain.lookup("run", "en"))?.senses).toHaveLength(2);
  });

  it("merges synonyms case insensitively and without repeats", async () => {
    const chain = chainOf([
      fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")], synonyms: ["Luck", "chance"] } }),
      fakeProvider({ id: "b", entry: { senses: [sense("noun", "y")], synonyms: ["luck", "fortune"] } }),
    ]);

    const entry = await chain.lookup("serendipity", "en");
    expect(entry?.synonyms).toEqual(["Luck", "chance", "fortune"]);
  });

  it("merges pronunciations and drops exact repeats", async () => {
    const chain = chainOf([
      fakeProvider({
        id: "a",
        entry: { senses: [sense("noun", "x")], pronunciations: [{ ipa: "/kat/", source: "a" }] },
      }),
      fakeProvider({
        id: "b",
        entry: {
          senses: [sense("noun", "y")],
          pronunciations: [
            { ipa: "/kat/", source: "b" },
            { audioUrl: "https://example.test/cat.ogg", source: "b" },
          ],
        },
      }),
    ]);

    const entry = await chain.lookup("cat", "en");
    expect(entry?.pronunciations).toHaveLength(2);
  });

  it("takes the first etymology offered and does not stack them", async () => {
    const chain = chainOf([
      fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")], etymology: "from Old English" } }),
      fakeProvider({ id: "b", entry: { senses: [sense("noun", "y")], etymology: "from Latin" } }),
    ]);

    expect((await chain.lookup("word", "en"))?.etymology).toBe("from Old English");
  });

  it("credits only the providers that actually contributed", async () => {
    const chain = chainOf([
      fakeProvider({ id: "answered", entry: { senses: [sense("noun", "x")] } }),
      fakeProvider({ id: "had-nothing", entry: null }),
    ]);

    const entry = await chain.lookup("word", "en");
    expect(entry?.attribution.map((credit) => credit.source)).toEqual(["answered"]);
  });
});

describe("resilience", () => {
  it("still returns an entry when one provider throws", async () => {
    const chain = chainOf([
      fakeProvider({ id: "broken", fail: true }),
      fakeProvider({ id: "working", entry: { senses: [sense("noun", "a definition")] } }),
    ]);

    const entry = await chain.lookup("word", "en");

    expect(entry?.senses).toHaveLength(1);
    expect(entry?.sources).toEqual(["working"]);
  });

  it("returns null rather than throwing when every provider fails", async () => {
    const chain = chainOf([fakeProvider({ id: "a", fail: true }), fakeProvider({ id: "b", fail: true })]);
    expect(await chain.lookup("word", "en")).toBeNull();
  });

  it("returns null when the word simply has no entry anywhere", async () => {
    const chain = chainOf([fakeProvider({ id: "a", entry: null })]);
    expect(await chain.lookup("zzzznotaword", "en")).toBeNull();
  });

  it("returns null when a provider answers with no usable senses", async () => {
    const chain = chainOf([fakeProvider({ id: "a", entry: { senses: [] } })]);
    expect(await chain.lookup("word", "en")).toBeNull();
  });

  it("refuses an empty word before touching a provider", async () => {
    const provider = fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")] } });
    await expect(chainOf([provider]).lookup("   ", "en")).rejects.toThrow(ProviderError);
    expect(provider.calls).toHaveLength(0);
  });
});

describe("language handling", () => {
  it("skips a provider that does not cover the language", async () => {
    const englishOnly = fakeProvider({
      id: "english-only",
      supports: (lang) => lang === "en",
      entry: { senses: [sense("noun", "x")] },
    });
    const everything = fakeProvider({ id: "everything", entry: { senses: [sense("noun", "neko")] } });

    const entry = await chainOf([englishOnly, everything]).lookup("猫", "ja");

    expect(englishOnly.calls).toHaveLength(0);
    expect(entry?.sources).toEqual(["everything"]);
  });

  it("resolves a dialect tag to its base language before looking up", async () => {
    const provider = fakeProvider({
      id: "a",
      supports: (lang) => lang === "es",
      entry: { senses: [sense("noun", "coche")] },
    });

    const entry = await chainOf([provider]).lookup("carro", "es-MX");

    expect(entry).not.toBeNull();
    expect(entry?.lang).toBe("es");
  });

  it("fills in script and direction from the registry", async () => {
    const chain = chainOf([fakeProvider({ id: "a", entry: { senses: [sense("noun", "book")] } })]);

    const urdu = await chain.lookup("کتاب", "ur");
    expect(urdu?.dir).toBe("rtl");
    expect(urdu?.script).toBe("Arab");

    const japanese = await chain.lookup("猫", "ja");
    expect(japanese?.dir).toBe("ltr");
    expect(japanese?.script).toBe("Jpan");
  });
});

describe("caching", () => {
  it("serves a repeat lookup without calling the providers again", async () => {
    const provider = fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")] } });
    const chain = chainOf([provider]);

    await chain.lookup("cat", "en");
    await chain.lookup("cat", "en");

    expect(provider.calls).toHaveLength(1);
  });

  it("ignores case and surrounding space when matching the cache", async () => {
    const provider = fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")] } });
    const chain = chainOf([provider]);

    await chain.lookup("Cat", "en");
    await chain.lookup("  cat  ", "en");

    expect(provider.calls).toHaveLength(1);
  });

  it("keeps entries for different languages apart", async () => {
    const provider = fakeProvider({ id: "a", entry: { senses: [sense("noun", "x")] } });
    const chain = chainOf([provider]);

    await chain.lookup("son", "en");
    await chain.lookup("son", "fr");

    expect(provider.calls).toHaveLength(2);
  });
});
