"use client";

import { useEffect, useState } from "react";
import { isWordSaved, removeSavedWord, saveWord, subscribeToSavedWords } from "@/lib/savedWords";

export interface SaveButtonProps {
  word: string;
  lang: string;
  reading?: string;
  definition: string;
}

/**
 * Adds or removes the current headword from the reader's saved list.
 *
 * The list lives in localStorage rather than on a server, so this has to be a
 * client component even though the rest of the entry page renders on the
 * server. It reads its own saved state on mount rather than trusting a prop,
 * since the same word can be saved from a second tab.
 */
export function SaveButton({ word, lang, reading, definition }: SaveButtonProps) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isWordSaved(lang, word));
    sync();
    return subscribeToSavedWords(sync);
  }, [lang, word]);

  return (
    <button
      type="button"
      className={saved ? "wk-btn wk-btn--sm wk-btn--seal" : "wk-btn wk-btn--sm wk-btn--quiet"}
      aria-pressed={saved}
      onClick={() => {
        if (saved) {
          removeSavedWord(lang, word);
        } else {
          saveWord({ word, lang, definition, ...(reading ? { reading } : {}) });
        }
      }}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}
