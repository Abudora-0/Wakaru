import type { Pronunciation } from "../types.js";
import { fetchJson } from "../util/http.js";
import { baseOf } from "../dialects/index.js";

interface ImageInfoResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        imageinfo?: { url?: string; mime?: string }[];
      }
    >;
  };
}

/**
 * Human pronunciation recordings for any language.
 *
 * dictionaryapi.dev only covers English, so every other language needs another
 * source. Each Wiktionary page embeds the Lingua Libre recordings for its
 * headword, and asking that wiki's own API for the page's files with their
 * URLs attached gets all of them in a single request. Going through the
 * language wiki rather than Commons directly also means one host per lookup.
 *
 * Lingua Libre names encode the language and the speaker, for example
 * "LL-Q150 (fra)-Guilhelma-eau.wav", so recordings can be labelled instead of
 * offered as an anonymous play button.
 */
export async function fetchWiktionaryAudio(
  word: string,
  lang: string,
  signal?: AbortSignal,
  limit = 4,
): Promise<Pronunciation[]> {
  const base = baseOf(lang);
  const url = new URL(`https://${base}.wiktionary.org/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "images");
  url.searchParams.set("gimlimit", "40");
  url.searchParams.set("titles", word);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  const data = await fetchJson<ImageInfoResponse>(url.toString(), {
    provider: "wiktionary-audio",
    signal,
    timeoutMs: 6_000,
  });

  const pages = Object.values(data.query?.pages ?? {});
  const found: Pronunciation[] = [];

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info?.url || !info.mime?.startsWith("audio/")) continue;

    // Only keep recordings of this word, not unrelated audio on the page.
    const title = page.title ?? "";
    if (!title.toLowerCase().includes(word.toLowerCase())) continue;

    found.push({
      audioUrl: stripTracking(info.url),
      ...(speakerFrom(title) ? { accent: speakerFrom(title) as string } : {}),
      source: "wiktionary-audio",
    });

    if (found.length >= limit) break;
  }

  return found;
}

/** The API appends campaign parameters that do not belong in a media element. */
function stripTracking(url: string): string {
  const parsed = new URL(url);
  parsed.search = "";
  return parsed.toString();
}

/** Pull the contributor name out of a Lingua Libre filename. */
function speakerFrom(title: string): string | undefined {
  const match = /LL-(?:Q\d+\s*)?\(?(\w{2,3})\)?-([^-]+)-/.exec(title);
  const speaker = match?.[2];
  return speaker ? `recorded by ${speaker}` : undefined;
}
