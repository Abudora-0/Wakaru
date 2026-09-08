import type { DictionaryProvider, Sense, UnifiedEntry } from "../types";
import { fetchJson } from "../util/http";

interface JishoWord {
  word?: string;
  reading?: string;
}

interface JishoSense {
  english_definitions?: string[];
  parts_of_speech?: string[];
}

interface JishoResult {
  japanese?: JishoWord[];
  senses?: JishoSense[];
}

interface JishoResponse {
  data?: JishoResult[];
}

/**
 * Jisho.org, backed by JMdict.
 *
 * Wiktionary's Japanese coverage is thin and never carries the reading, so a
 * kanji headword renders with no furigana at all. JMdict exists specifically
 * for Japanese, and every entry pairs a word with its kana reading, which is
 * the one thing this provider is here for. English definitions come along for
 * free and are kept too, since a second opinion never hurts, but the reading
 * is the reason it is in the chain.
 *
 * The endpoint is undocumented but stable and widely relied on; it has no key
 * and no published quota.
 */
export function createJishoProvider(): DictionaryProvider {
  const id = "jisho";

  return {
    id,
    label: "Jisho (JMdict)",
    attribution: {
      source: "Jisho.org, from JMdict/EDICT",
      license: "CC BY-SA 4.0",
      url: "https://jisho.org",
    },

    supports(lang) {
      return lang === "ja";
    },

    async lookup(word, _lang, signal): Promise<Partial<UnifiedEntry> | null> {
      const url = `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`;
      const data = await fetchJson<JishoResponse>(url, { provider: id, signal });

      // Jisho searches fuzzily and returns related words first, so only the
      // top result is used, and only when it is genuinely the word asked for
      // rather than something merely close to it. Anything looser would
      // attribute someone else's reading and definitions to this headword.
      const result = data.data?.find((candidate) =>
        candidate.japanese?.some((form) => form.word === word || form.reading === word),
      );
      if (!result) return null;

      const matched = result.japanese?.find((form) => form.word === word) ?? result.japanese?.find((form) => form.reading === word);
      const reading = matched?.reading;

      const senses: Sense[] = [];
      for (const sense of result.senses ?? []) {
        const definitions = sense.english_definitions?.filter(Boolean) ?? [];
        if (definitions.length === 0) continue;
        const partOfSpeech = sense.parts_of_speech?.[0]?.toLowerCase() ?? "unknown";
        // "Wikipedia definition" entries are encyclopedia stubs, not the kind
        // of sense a dictionary page should list alongside real definitions.
        if (partOfSpeech === "wikipedia definition") continue;
        senses.push({ partOfSpeech, definition: definitions.join("; "), examples: [], synonyms: [], antonyms: [] });
      }

      if (senses.length === 0) return null;

      return {
        word,
        lang: "ja",
        script: "Jpan",
        dir: "ltr",
        // A kana only word already reads as itself, so ruby text over it
        // would just repeat the headword rather than annotate it.
        ...(reading && reading !== word ? { reading } : {}),
        pronunciations: [],
        senses,
        synonyms: [],
        antonyms: [],
        forms: [],
        sources: [id],
      };
    },
  };
}
