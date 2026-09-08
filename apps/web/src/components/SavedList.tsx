"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  type SavedWord,
  exportSavedWordsAsJson,
  exportSavedWordsAsText,
  getSavedWords,
  removeSavedWord,
  subscribeToSavedWords,
} from "@/lib/savedWords";

function download(filename: string, contents: string, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The saved list itself.
 *
 * This is a client component inside an otherwise static page because the
 * list lives entirely in the reader's own browser: there is no account
 * anywhere in this project, so nothing here can be rendered on the server.
 */
export function SavedList() {
  const [words, setWords] = useState<SavedWord[] | null>(null);

  useEffect(() => {
    const sync = () => setWords(getSavedWords());
    sync();
    return subscribeToSavedWords(sync);
  }, []);

  // Nothing render worthy until the client has actually checked storage, so
  // an empty list is never shown to a reader who does have saved words.
  if (words === null) return null;

  if (words.length === 0) {
    return (
      <p className="saved__notice">
        Nothing saved yet. The Save button on any dictionary entry adds it here, kept in this browser alone.
      </p>
    );
  }

  return (
    <>
      <div className="saved__toolbar">
        <span className="runhead__note">{words.length} saved</span>
        <div className="saved__exports">
          <button
            type="button"
            className="wk-btn wk-btn--sm wk-btn--quiet"
            onClick={() => download("wakaru-saved-words.json", exportSavedWordsAsJson(), "application/json")}
          >
            Export JSON
          </button>
          <button
            type="button"
            className="wk-btn wk-btn--sm wk-btn--quiet"
            onClick={() => download("wakaru-saved-words.txt", exportSavedWordsAsText(), "text/plain")}
          >
            Export text
          </button>
        </div>
      </div>

      <ul className="saved__list">
        {words.map((item) => (
          <li key={item.key} className="saved__item">
            <Link href={`/dictionary/${item.lang}/${encodeURIComponent(item.word)}`} className="saved__word">
              {item.reading ? <span className="saved__reading">{item.reading}</span> : null}
              <span lang={item.lang}>{item.word}</span>
            </Link>
            <p className="saved__definition">{item.definition}</p>
            <div className="saved__meta">
              <span className="wk-caps">{item.lang}</span>
              <button
                type="button"
                className="wk-btn wk-btn--sm wk-btn--quiet"
                onClick={() => removeSavedWord(item.lang, item.word)}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
