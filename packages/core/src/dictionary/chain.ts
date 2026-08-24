import { ProviderError } from "../types.js";
import type { Attribution, DictionaryProvider, LangCode, Pronunciation, Sense, UnifiedEntry } from "../types.js";
import { Lru } from "../util/lru.js";
import { directionOf, scriptOf } from "../languages/index.js";
import { baseOf } from "../dialects/index.js";
import { fetchWiktionaryAudio } from "./wiktionary-audio.js";
import { DATAMUSE_ATTRIBUTION, fetchRelatedWords } from "./datamuse.js";

export interface DictionaryChainOptions {
  providers: DictionaryProvider[];
  cache?: Lru<UnifiedEntry>;
  /** Look up human recordings from Wiktionary for non English languages. */
  enrichAudio?: boolean;
  /** Add Datamuse synonyms and antonyms for English. */
  enrichEnglishRelated?: boolean;
}

/** Two definitions are the same when their opening words match. */
function definitionKey(sense: Sense): string {
  return `${sense.partOfSpeech}:${sense.definition.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 60)}`;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value.trim());
  }
  return out;
}

function dedupePronunciations(values: Pronunciation[]): Pronunciation[] {
  const seen = new Set<string>();
  const out: Pronunciation[] = [];
  for (const value of values) {
    const key = `${value.ipa ?? ""}|${value.audioUrl ?? ""}`;
    if (key === "|" || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

/**
 * Runs every provider that covers the language and folds the answers into one
 * entry.
 *
 * Unlike the translation chain this does not stop at the first success. A
 * dictionary entry is better when it is the union of its sources: English gets
 * definitions and audio from dictionaryapi.dev, extra senses from Wiktionary
 * and synonyms from Datamuse, and the reader sees one page rather than three.
 */
export class DictionaryChain {
  private readonly providers: DictionaryProvider[];
  private readonly cache: Lru<UnifiedEntry>;
  private readonly enrichAudio: boolean;
  private readonly enrichEnglishRelated: boolean;

  constructor(options: DictionaryChainOptions) {
    this.providers = options.providers;
    this.cache = options.cache ?? new Lru<UnifiedEntry>(600);
    this.enrichAudio = options.enrichAudio ?? true;
    this.enrichEnglishRelated = options.enrichEnglishRelated ?? true;
  }

  async lookup(word: string, lang: LangCode, signal?: AbortSignal): Promise<UnifiedEntry | null> {
    const term = word.trim();
    if (!term) throw new ProviderError("chain", "unsupported", "no word given");

    const base = baseOf(lang);
    const cacheKey = `${base}:${term.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const candidates = this.providers.filter((provider) => provider.supports(base));

    // Every source is independent, so they all go out at once. A provider
    // that fails is simply absent from the merge rather than fatal.
    const settled = await Promise.allSettled(
      candidates.map((provider) => provider.lookup(term, base, signal)),
    );

    const parts: Partial<UnifiedEntry>[] = [];
    const attribution: Attribution[] = [];
    const sources: string[] = [];

    settled.forEach((outcome, index) => {
      const provider = candidates[index];
      if (!provider) return;
      if (outcome.status !== "fulfilled" || !outcome.value) return;
      parts.push(outcome.value);
      attribution.push(provider.attribution);
      sources.push(provider.id);
    });

    if (parts.length === 0) return null;

    const senses: Sense[] = [];
    const seenSenses = new Set<string>();
    let pronunciations: Pronunciation[] = [];
    let synonyms: string[] = [];
    let antonyms: string[] = [];
    let forms: string[] = [];
    let etymology: string | undefined;
    let reading: string | undefined;

    for (const part of parts) {
      for (const sense of part.senses ?? []) {
        const key = definitionKey(sense);
        if (seenSenses.has(key)) continue;
        seenSenses.add(key);
        senses.push(sense);
      }
      pronunciations = pronunciations.concat(part.pronunciations ?? []);
      synonyms = synonyms.concat(part.synonyms ?? []);
      antonyms = antonyms.concat(part.antonyms ?? []);
      forms = forms.concat(part.forms ?? []);
      if (!etymology && part.etymology) etymology = part.etymology;
      if (!reading && part.reading) reading = part.reading;
    }

    if (senses.length === 0) return null;

    // Enrichment runs after the merge so it can see what is already missing.
    const needsAudio = this.enrichAudio && !pronunciations.some((p) => p.audioUrl);
    const needsRelated = this.enrichEnglishRelated && base === "en" && synonyms.length === 0;

    const [audio, related] = await Promise.all([
      needsAudio ? fetchWiktionaryAudio(term, base, signal).catch(() => []) : Promise.resolve([]),
      needsRelated
        ? fetchRelatedWords(term, signal).catch(() => ({ synonyms: [], antonyms: [] }))
        : Promise.resolve({ synonyms: [], antonyms: [] }),
    ]);

    if (audio.length > 0) {
      pronunciations = pronunciations.concat(audio);
      attribution.push({
        source: "Wikimedia Commons, Lingua Libre recordings",
        license: "CC BY-SA 4.0",
        url: "https://lingualibre.org",
      });
      sources.push("wiktionary-audio");
    }

    if (related.synonyms.length > 0 || related.antonyms.length > 0) {
      synonyms = synonyms.concat(related.synonyms);
      antonyms = antonyms.concat(related.antonyms);
      attribution.push({ ...DATAMUSE_ATTRIBUTION });
      sources.push("datamuse");
    }

    const entry: UnifiedEntry = {
      word: term,
      lang: base,
      script: scriptOf(base),
      dir: directionOf(base),
      ...(reading ? { reading } : {}),
      pronunciations: dedupePronunciations(pronunciations),
      senses,
      synonyms: dedupeStrings(synonyms),
      antonyms: dedupeStrings(antonyms),
      forms: dedupeStrings(forms),
      ...(etymology ? { etymology } : {}),
      attribution,
      sources,
    };

    this.cache.set(cacheKey, entry);
    return entry;
  }
}
