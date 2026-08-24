import type { DictionaryProvider, Example, Sense, UnifiedEntry } from "../types";
import { fetchJson } from "../util/http";
import { extractExample, looksLikeProse, stripWikiHtml } from "../util/html";
import { directionOf, scriptOf } from "../languages/index";
import { baseOf } from "../dialects/index";

/**
 * The REST endpoint keys its result by language code, so one lookup of a word
 * returns every language that spells it the same way. That is why "agua"
 * comes back with Asturian, Galician, Portuguese and Spanish all at once.
 */
type DefinitionResponse = Record<
  string,
  {
    partOfSpeech?: string;
    language?: string;
    definitions?: {
      definition?: string;
      parsedExamples?: { example?: string; translation?: string }[];
      examples?: string[];
    }[];
  }[]
>;

/**
 * Wiktionary, the multilingual backbone.
 *
 * This is the only free, keyless source that covers most of the world's
 * written languages. The cost is that it returns MediaWiki HTML rather than
 * text, and it is CC BY-SA, which makes per entry attribution a licence
 * obligation rather than a courtesy.
 */
export function createWiktionaryProvider(): DictionaryProvider {
  const id = "wiktionary";

  return {
    id,
    label: "Wiktionary",
    attribution: {
      source: "Wiktionary",
      license: "CC BY-SA 4.0",
      url: "https://en.wiktionary.org",
    },

    supports() {
      // Coverage varies by word rather than by language, so this never
      // pre-rejects. A language with no entry simply returns null.
      return true;
    },

    async lookup(word, lang, signal): Promise<Partial<UnifiedEntry> | null> {
      const base = baseOf(lang);
      const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
      const data = await fetchJson<DefinitionResponse>(url, { provider: id, signal });

      const blocks = data[base];
      if (!blocks || blocks.length === 0) return null;

      const senses: Sense[] = [];

      for (const block of blocks) {
        const partOfSpeech = block.partOfSpeech?.toLowerCase() ?? "unknown";

        for (const definition of block.definitions ?? []) {
          const text = stripWikiHtml(definition.definition ?? "");
          if (!text || !looksLikeProse(text)) continue;

          const examples: Example[] = [];

          for (const parsed of definition.parsedExamples ?? []) {
            const example = extractExample(parsed.example ?? "");
            if (!example.text) continue;
            const translation = parsed.translation ? stripWikiHtml(parsed.translation) : undefined;
            examples.push({
              text: example.text,
              ...(translation ? { translation } : {}),
              source: id,
            });
          }

          // Some entries only carry the unparsed example list.
          if (examples.length === 0) {
            for (const raw of definition.examples ?? []) {
              const cleaned = stripWikiHtml(raw);
              if (cleaned) examples.push({ text: cleaned, source: id });
            }
          }

          senses.push({ partOfSpeech, definition: text, examples, synonyms: [], antonyms: [] });
        }
      }

      if (senses.length === 0) return null;

      return {
        word,
        lang: base,
        script: scriptOf(base),
        dir: directionOf(base),
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

/**
 * Which other languages spell this word the same way.
 *
 * This falls out of the same response for free and is genuinely useful: it is
 * how a reader discovers that a word they know is also a word somewhere else.
 */
export async function findLanguagesForWord(word: string, signal?: AbortSignal): Promise<string[]> {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`;
  const data = await fetchJson<DefinitionResponse>(url, { provider: "wiktionary", signal });
  return Object.keys(data);
}
