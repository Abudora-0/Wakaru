import type { DictionaryProvider, Pronunciation, Sense, UnifiedEntry } from "../types";
import { fetchJson } from "../util/http";

interface DevEntry {
  word?: string;
  phonetic?: string;
  phonetics?: { text?: string; audio?: string; sourceUrl?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string; synonyms?: string[]; antonyms?: string[] }[];
    synonyms?: string[];
    antonyms?: string[];
  }[];
  origin?: string;
  sourceUrls?: string[];
}

/**
 * dictionaryapi.dev, the richest free English source.
 *
 * It is the only provider that ships human recordings alongside the IPA, and
 * the audio filenames carry the accent, so "serendipity-us.mp3" becomes a
 * labelled American pronunciation rather than an unlabelled sound file.
 */
export function createDictionaryApiDevProvider(): DictionaryProvider {
  const id = "dictionaryapi-dev";

  return {
    id,
    label: "Free Dictionary API",
    attribution: {
      source: "dictionaryapi.dev, sourced from Wiktionary",
      license: "CC BY-SA 3.0",
      url: "https://dictionaryapi.dev",
    },

    supports(lang) {
      return lang === "en" || lang.startsWith("en-");
    },

    async lookup(word, _lang, signal): Promise<Partial<UnifiedEntry> | null> {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const data = await fetchJson<DevEntry[]>(url, { provider: id, signal });
      if (!Array.isArray(data) || data.length === 0) return null;

      const pronunciations: Pronunciation[] = [];
      const senses: Sense[] = [];
      const synonyms = new Set<string>();
      const antonyms = new Set<string>();
      let etymology: string | undefined;

      for (const entry of data) {
        if (!etymology && entry.origin) etymology = entry.origin;

        for (const phonetic of entry.phonetics ?? []) {
          if (!phonetic.text && !phonetic.audio) continue;
          pronunciations.push({
            ...(phonetic.text ? { ipa: phonetic.text } : {}),
            ...(phonetic.audio ? { audioUrl: phonetic.audio } : {}),
            ...(accentFromAudioUrl(phonetic.audio) ? { accent: accentFromAudioUrl(phonetic.audio) as string } : {}),
            source: id,
          });
        }

        if (pronunciations.length === 0 && entry.phonetic) {
          pronunciations.push({ ipa: entry.phonetic, source: id });
        }

        for (const meaning of entry.meanings ?? []) {
          for (const syn of meaning.synonyms ?? []) synonyms.add(syn);
          for (const ant of meaning.antonyms ?? []) antonyms.add(ant);

          for (const definition of meaning.definitions ?? []) {
            if (!definition.definition) continue;
            for (const syn of definition.synonyms ?? []) synonyms.add(syn);
            for (const ant of definition.antonyms ?? []) antonyms.add(ant);

            senses.push({
              partOfSpeech: meaning.partOfSpeech ?? "unknown",
              definition: definition.definition,
              examples: definition.example ? [{ text: definition.example, source: id }] : [],
              synonyms: definition.synonyms ?? [],
              antonyms: definition.antonyms ?? [],
            });
          }
        }
      }

      if (senses.length === 0) return null;

      return {
        word: data[0]?.word ?? word,
        lang: "en",
        script: "Latn",
        dir: "ltr",
        pronunciations,
        senses,
        synonyms: [...synonyms],
        antonyms: [...antonyms],
        forms: [],
        ...(etymology ? { etymology } : {}),
        sources: [id],
      };
    },
  };
}

/**
 * The audio filenames end in a region suffix, so a recording can be labelled
 * rather than presented as a bare play button.
 */
function accentFromAudioUrl(audio?: string): string | undefined {
  if (!audio) return undefined;
  const match = /-(\w{2})\.mp3$/.exec(audio);
  const code = match?.[1]?.toLowerCase();
  if (!code) return undefined;

  const labels: Record<string, string> = {
    us: "American",
    uk: "British",
    au: "Australian",
    ca: "Canadian",
  };
  return labels[code] ?? code.toUpperCase();
}
