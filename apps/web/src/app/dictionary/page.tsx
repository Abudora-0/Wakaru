import type { Metadata } from "next";
import { LANGUAGES } from "@wakaru/core";
import { DictionarySearch } from "@/components/DictionarySearch";
import "./dictionary.css";

export const metadata: Metadata = {
  title: "Dictionary",
  description:
    "Look up a word in any of 107 languages. Definitions, pronunciation in IPA, human recordings, synonyms and real example sentences.",
};

export default function DictionaryPage() {
  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title">Dictionary</h1>
        <span className="runhead__note">{LANGUAGES.length} languages</span>
      </div>

      <DictionarySearch />
    </>
  );
}
