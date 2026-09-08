"use client";

/**
 * A saved word list, kept entirely in the browser.
 *
 * There is no account system anywhere in this project, so a saved list lives
 * in localStorage rather than on a server: it is private by construction,
 * survives a reload, and costs nothing to run. The cost is the one every
 * client side list has, it does not follow the reader to another device or
 * browser, which is exactly what the export button on /saved is for.
 */

export interface SavedWord {
  /** `${lang}:${word}`, the natural primary key for a dictionary entry. */
  key: string;
  word: string;
  lang: string;
  reading?: string;
  /** The first sense's definition, kept short for the list view. */
  definition: string;
  savedAt: string;
}

const STORAGE_KEY = "wakaru:saved-words";
const CHANGE_EVENT = "wakaru:saved-words-changed";

function keyFor(lang: string, word: string): string {
  return `${lang}:${word}`;
}

function read(): SavedWord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedWord[]) : [];
  } catch {
    // A private window, cleared site data, or storage disabled outright all
    // land here. An empty list is the correct fallback, not an error.
    return [];
  }
}

function write(list: SavedWord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage can be full, or blocked entirely in some private modes.
    // Saving a word is a nicety, never worth surfacing a hard failure for.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getSavedWords(): SavedWord[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isWordSaved(lang: string, word: string): boolean {
  const key = keyFor(lang, word);
  return read().some((item) => item.key === key);
}

export function saveWord(entry: { word: string; lang: string; reading?: string; definition: string }): void {
  const key = keyFor(entry.lang, entry.word);
  const list = read().filter((item) => item.key !== key);
  list.push({ ...entry, key, savedAt: new Date().toISOString() });
  write(list);
}

export function removeSavedWord(lang: string, word: string): void {
  const key = keyFor(lang, word);
  write(read().filter((item) => item.key !== key));
}

/** Runs on any change, including one made from another tab. */
export function subscribeToSavedWords(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function exportSavedWordsAsJson(): string {
  return JSON.stringify(getSavedWords(), null, 2);
}

export function exportSavedWordsAsText(): string {
  return getSavedWords()
    .map((item) => {
      const heading = item.reading ? `${item.word} (${item.reading})` : item.word;
      return `${heading}, ${item.lang}\n${item.definition}\n`;
    })
    .join("\n");
}
