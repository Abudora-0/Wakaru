import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLanguage } from "@wakaru/core";
import { DictionarySearch } from "@/components/DictionarySearch";
import "../dictionary.css";

interface Props {
  params: Promise<{ lang: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const language = getLanguage(lang);
  return {
    title: language ? `${language.name} dictionary` : "Dictionary",
    description: language
      ? `Look up a word in ${language.name}, with pronunciation, examples and synonyms.`
      : undefined,
  };
}

export default async function LanguageDictionaryPage({ params }: Props) {
  const { lang } = await params;
  const language = getLanguage(lang);
  if (!language) notFound();

  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title" lang={language.code} dir={language.dir}>
          {language.native}
        </h1>
        <span className="runhead__note">
          {language.name} / {language.script} / {language.family}
        </span>
      </div>

      {language.dialects.length > 0 ? (
        <p className="notice notice--quiet" style={{ marginBottom: "var(--wk-s-6)" }}>
          {language.name} has {language.dialects.length}{" "}
          {language.dialects.length === 1 ? "dialect" : "dialects"} in the register:{" "}
          {language.dialects.map((dialect) => dialect.name).join(", ")}. Pick one on the translator to see the
          difference it makes.
        </p>
      ) : null}

      <DictionarySearch initialLang={language.code} />
    </>
  );
}
