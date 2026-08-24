import { afterEach, describe, expect, it, vi } from "vitest";
import { createDictionaryApiDevProvider } from "./dictionaryapi-dev";
import { createWiktionaryProvider } from "./wiktionary";

/**
 * These two providers are the layer that turns whatever an upstream service
 * feels like sending into the single entry shape the interface renders. The
 * fixtures below are the real response shapes, trimmed, so that if an upstream
 * changes format these tests fail rather than the page quietly going blank.
 */

afterEach(() => vi.unstubAllGlobals());

function respondWith(payload: unknown, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    }) as unknown as Response),
  );
}

describe("dictionaryapi.dev", () => {
  const fixture = [
    {
      word: "serendipity",
      phonetic: "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/",
      phonetics: [
        { text: "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/serendipity-au.mp3" },
        { text: "/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/", audio: "https://api.dictionaryapi.dev/media/pronunciations/en/serendipity-us.mp3" },
        { text: "", audio: "" },
      ],
      meanings: [
        {
          partOfSpeech: "noun",
          definitions: [
            { definition: "A combination of events which have come together by chance.", example: "a fortunate stroke of serendipity" },
            { definition: "An unsought discovery.", synonyms: ["fluke"] },
          ],
          synonyms: ["chance", "luck"],
          antonyms: ["design"],
        },
      ],
      origin: "1754, coined by Horace Walpole.",
    },
  ];

  it("only claims English", () => {
    const provider = createDictionaryApiDevProvider();
    expect(provider.supports("en")).toBe(true);
    expect(provider.supports("en-GB")).toBe(true);
    expect(provider.supports("ja")).toBe(false);
  });

  it("flattens every meaning into a flat list of senses", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");

    expect(entry?.senses).toHaveLength(2);
    expect(entry?.senses?.[0]?.partOfSpeech).toBe("noun");
  });

  it("labels a recording from the region suffix in its filename", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");

    const accents = entry?.pronunciations?.map((item) => item.accent);
    expect(accents).toContain("Australian");
    expect(accents).toContain("American");
  });

  it("ignores a phonetics row that carries neither text nor audio", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");
    expect(entry?.pronunciations).toHaveLength(2);
  });

  it("gathers synonyms from the meaning and the definition alike", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");

    expect(entry?.synonyms).toContain("chance");
    expect(entry?.synonyms).toContain("fluke");
    expect(entry?.antonyms).toContain("design");
  });

  it("keeps the example attached to its own sense", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");

    expect(entry?.senses?.[0]?.examples?.[0]?.text).toBe("a fortunate stroke of serendipity");
    expect(entry?.senses?.[1]?.examples).toHaveLength(0);
  });

  it("carries the origin across as the etymology", async () => {
    respondWith(fixture);
    const entry = await createDictionaryApiDevProvider().lookup("serendipity", "en");
    expect(entry?.etymology).toContain("Horace Walpole");
  });

  it("falls back to the top level phonetic when the array is empty", async () => {
    respondWith([{ word: "x", phonetic: "/eks/", phonetics: [], meanings: [{ partOfSpeech: "noun", definitions: [{ definition: "a letter" }] }] }]);
    const entry = await createDictionaryApiDevProvider().lookup("x", "en");

    expect(entry?.pronunciations?.[0]?.ipa).toBe("/eks/");
  });

  it("returns null for an empty response", async () => {
    respondWith([]);
    expect(await createDictionaryApiDevProvider().lookup("nothing", "en")).toBeNull();
  });

  it("returns null when there are no usable definitions", async () => {
    respondWith([{ word: "x", meanings: [{ partOfSpeech: "noun", definitions: [{}] }] }]);
    expect(await createDictionaryApiDevProvider().lookup("x", "en")).toBeNull();
  });
});

describe("Wiktionary", () => {
  // The REST endpoint keys its answer by language, so one lookup of a spelling
  // returns every language that writes the word the same way.
  const fixture = {
    ja: [
      {
        partOfSpeech: "Noun",
        language: "Japanese",
        definitions: [
          {
            definition: '<style data-mw-deduplicate="x">.defdate{font-size:smaller}</style> a <a rel="mw:WikiLink" href="/wiki/cat">cat</a>',
            parsedExamples: [{ example: "その<b>猫</b>は白い", translation: "That <b>cat</b> is white" }],
            examples: ["その<b>猫</b>は白い"],
          },
          { definition: "" },
        ],
      },
    ],
    en: [
      {
        partOfSpeech: "Verb",
        language: "English",
        definitions: [{ definition: "to do something", examples: ["He <b>did</b> it"] }],
      },
    ],
  };

  it("never pre-rejects a language, because coverage varies by word", () => {
    const provider = createWiktionaryProvider();
    expect(provider.supports("ja")).toBe(true);
    expect(provider.supports("qqq")).toBe(true);
  });

  it("picks the block for the language that was asked for", async () => {
    respondWith(fixture);
    const entry = await createWiktionaryProvider().lookup("猫", "ja");

    expect(entry?.lang).toBe("ja");
    expect(entry?.senses).toHaveLength(1);
    expect(entry?.senses?.[0]?.partOfSpeech).toBe("noun");
  });

  it("strips the TemplateStyles block out of the definition", async () => {
    respondWith(fixture);
    const entry = await createWiktionaryProvider().lookup("猫", "ja");

    expect(entry?.senses?.[0]?.definition).toBe("a cat");
    expect(entry?.senses?.[0]?.definition).not.toContain("font-size");
  });

  it("lifts a parsed example together with its translation", async () => {
    respondWith(fixture);
    const example = (await createWiktionaryProvider().lookup("猫", "ja"))?.senses?.[0]?.examples?.[0];

    expect(example?.text).toBe("その猫は白い");
    expect(example?.translation).toBe("That cat is white");
  });

  it("falls back to the unparsed example list when there is no parsed one", async () => {
    respondWith(fixture);
    const entry = await createWiktionaryProvider().lookup("did", "en");

    expect(entry?.senses?.[0]?.examples?.[0]?.text).toBe("He did it");
    expect(entry?.senses?.[0]?.examples?.[0]?.translation).toBeUndefined();
  });

  it("drops a definition that is empty once the markup is gone", async () => {
    respondWith(fixture);
    expect((await createWiktionaryProvider().lookup("猫", "ja"))?.senses).toHaveLength(1);
  });

  it("returns null when the word exists but not in that language", async () => {
    respondWith(fixture);
    expect(await createWiktionaryProvider().lookup("猫", "fr")).toBeNull();
  });

  it("resolves a dialect tag to its base language before choosing a block", async () => {
    respondWith(fixture);
    // ja-Kansai has no block of its own, so the Japanese one is correct.
    const entry = await createWiktionaryProvider().lookup("猫", "ja-Kansai");

    expect(entry?.lang).toBe("ja");
    expect(entry?.senses).toHaveLength(1);
  });

  it("sets script and direction from the registry", async () => {
    respondWith({ ur: [{ partOfSpeech: "Noun", definitions: [{ definition: "a book" }] }] });
    const entry = await createWiktionaryProvider().lookup("کتاب", "ur");

    expect(entry?.script).toBe("Arab");
    expect(entry?.dir).toBe("rtl");
  });
});

describe("Wiktionary audio", () => {
  // One call gets the files on a page with their URLs attached. The response
  // mixes illustrations, logos and recordings, so the filtering is the work.
  const page = (title: string, url: string, mime: string) => ({
    title,
    imageinfo: [{ url, mime }],
  });

  function respondPages(pages: Record<string, unknown>) {
    respondWith({ query: { pages } });
  }

  it("keeps recordings and discards the images on the same page", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondPages({
      "1": page("Fichier:LL-Q150 (fra)-Guilhelma-eau.wav", "https://upload.example/eau.wav", "audio/wav"),
      "2": page("Fichier:Water droplet.jpg", "https://upload.example/photo.jpg", "image/jpeg"),
      "3": page("Fichier:Wikipedia-logo.svg", "https://upload.example/logo.svg", "image/svg+xml"),
    });

    const found = await fetchWiktionaryAudio("eau", "fr");

    expect(found).toHaveLength(1);
    expect(found[0]?.audioUrl).toBe("https://upload.example/eau.wav");
  });

  it("ignores audio that belongs to some other word on the page", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondPages({
      "1": page("File:LL-Q150 (fra)-Speaker-eau.wav", "https://upload.example/eau.wav", "audio/wav"),
      "2": page("File:LL-Q150 (fra)-Speaker-feu.wav", "https://upload.example/feu.wav", "audio/wav"),
    });

    const found = await fetchWiktionaryAudio("eau", "fr");
    expect(found.map((item) => item.audioUrl)).toEqual(["https://upload.example/eau.wav"]);
  });

  it("strips the campaign parameters the API appends", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondPages({
      "1": page(
        "File:LL-Q150 (fra)-Guilhelma-eau.wav",
        "https://upload.example/eau.wav?utm_source=fr.wiktionary.org&utm_campaign=imageinfo",
        "audio/wav",
      ),
    });

    const found = await fetchWiktionaryAudio("eau", "fr");

    // Those parameters do not belong in the src of an audio element.
    expect(found[0]?.audioUrl).toBe("https://upload.example/eau.wav");
  });

  it("credits the contributor named in the Lingua Libre filename", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondPages({
      "1": page("File:LL-Q150 (fra)-Guilhelma-eau.wav", "https://upload.example/eau.wav", "audio/wav"),
    });

    expect((await fetchWiktionaryAudio("eau", "fr"))[0]?.accent).toBe("recorded by Guilhelma");
  });

  it("stops at the requested number of recordings", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondPages(
      Object.fromEntries(
        Array.from({ length: 8 }, (_unused, index) => [
          String(index),
          page(`File:LL-Q150 (fra)-Voice${index}-eau.wav`, `https://upload.example/eau${index}.wav`, "audio/wav"),
        ]),
      ),
    );

    expect(await fetchWiktionaryAudio("eau", "fr", undefined, 3)).toHaveLength(3);
  });

  it("returns nothing when the page has no files at all", async () => {
    const { fetchWiktionaryAudio } = await import("./wiktionary-audio");
    respondWith({ query: {} });
    expect(await fetchWiktionaryAudio("eau", "fr")).toEqual([]);
  });
});

describe("Datamuse", () => {
  it("returns the related words for both directions", async () => {
    const { fetchRelatedWords } = await import("./datamuse");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(url).includes("rel_syn")
            ? [{ word: "chance" }, { word: "luck" }]
            : [{ word: "design" }],
      }) as unknown as Response),
    );

    await expect(fetchRelatedWords("serendipity")).resolves.toEqual({
      synonyms: ["chance", "luck"],
      antonyms: ["design"],
    });
  });

  it("degrades to nothing rather than failing the whole entry", async () => {
    const { fetchRelatedWords } = await import("./datamuse");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));

    // Enrichment is a bonus on top of a real entry, so it must never be the
    // reason a lookup fails.
    await expect(fetchRelatedWords("serendipity")).resolves.toEqual({ synonyms: [], antonyms: [] });
  });
});
