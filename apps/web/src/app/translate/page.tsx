import type { Metadata } from "next";
import { LANGUAGES, totalDialectCount } from "@wakaru/core";
import { TranslateSpread } from "@/components/TranslateSpread";
import "./translate.css";

export const metadata: Metadata = {
  title: "Translate",
  description: "Translate between languages and their regional dialects, with every edit shown.",
};

export default function TranslatePage() {
  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title">Translate</h1>
        <span className="runhead__note">
          {LANGUAGES.length} languages / {totalDialectCount()} dialects
        </span>
      </div>

      <TranslateSpread />
    </>
  );
}
