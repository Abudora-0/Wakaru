"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { directionOf } from "@wakaru/core";
import { LanguageCombobox } from "./LanguageCombobox";

const SUGGESTIONS = [
  { word: "serendipity", lang: "en" },
  { word: "猫", lang: "ja" },
  { word: "eau", lang: "fr" },
  { word: "کتاب", lang: "ur" },
  { word: "saudade", lang: "pt" },
  { word: "ਪਿਆਰ", lang: "pa" },
  { word: "Sehnsucht", lang: "de" },
];

export function DictionarySearch({ initialWord = "", initialLang = "en" }: { initialWord?: string; initialLang?: string }) {
  const router = useRouter();
  const [word, setWord] = useState(initialWord);
  const [lang, setLang] = useState(initialLang);

  function go(nextWord: string, nextLang: string) {
    const term = nextWord.trim();
    if (!term) return;
    router.push(`/dictionary/${nextLang}/${encodeURIComponent(term)}`);
  }

  return (
    <div className="hunt">
      <form
        className="hunt__row"
        onSubmit={(event) => {
          event.preventDefault();
          go(word, lang);
        }}
      >
        <div className="hunt__field">
          <label className="wk-caps" htmlFor="hunt-word" style={{ display: "block", marginBottom: "var(--wk-s-1)" }}>
            Word
          </label>
          <input
            id="hunt-word"
            className="wk-field wk-field--boxed"
            value={word}
            dir={directionOf(lang)}
            lang={lang}
            placeholder="Any word, in any script"
            onChange={(event) => setWord(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div className="hunt__lang">
          <LanguageCombobox label="Language" value={lang} onChange={setLang} />
        </div>

        <button type="submit" className="wk-btn wk-btn--seal" disabled={!word.trim()}>
          Look up
        </button>
      </form>

      <p className="wk-caps">Try one of these</p>
      <div className="suggest">
        {SUGGESTIONS.map((entry) => (
          <button
            key={`${entry.lang}-${entry.word}`}
            type="button"
            className="wk-chip"
            lang={entry.lang}
            dir={directionOf(entry.lang)}
            onClick={() => go(entry.word, entry.lang)}
          >
            {entry.word}
          </button>
        ))}
      </div>
    </div>
  );
}
