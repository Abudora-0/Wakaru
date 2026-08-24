import { fetchJson } from "../util/http";

interface DatamuseWord {
  word: string;
  score?: number;
}

/**
 * Datamuse, used purely to enrich English synonyms and antonyms.
 *
 * It is not a dictionary provider in its own right because it returns no
 * definitions, so it is merged into an entry that another provider produced.
 */
export async function fetchRelatedWords(
  word: string,
  signal?: AbortSignal,
): Promise<{ synonyms: string[]; antonyms: string[] }> {
  const build = (relation: string): string => {
    const url = new URL("https://api.datamuse.com/words");
    url.searchParams.set(relation, word);
    url.searchParams.set("max", "12");
    return url.toString();
  };

  const [synonyms, antonyms] = await Promise.all([
    fetchJson<DatamuseWord[]>(build("rel_syn"), { provider: "datamuse", signal, timeoutMs: 5_000 }).catch(() => []),
    fetchJson<DatamuseWord[]>(build("rel_ant"), { provider: "datamuse", signal, timeoutMs: 5_000 }).catch(() => []),
  ]);

  return {
    synonyms: synonyms.map((entry) => entry.word),
    antonyms: antonyms.map((entry) => entry.word),
  };
}

export const DATAMUSE_ATTRIBUTION = {
  source: "Datamuse",
  license: "Free for public use",
  url: "https://www.datamuse.com/api/",
} as const;
