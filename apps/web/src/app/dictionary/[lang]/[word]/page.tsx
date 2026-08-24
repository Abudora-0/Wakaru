import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLanguage } from "@wakaru/core";
import { getDictionaryChain } from "@/lib/providers";
import { AudioButton } from "@/components/AudioButton";
import { SpeakButton } from "@/components/SpeakButton";
import { DictionarySearch } from "@/components/DictionarySearch";
import "../../dictionary.css";

interface Props {
  params: Promise<{ lang: string; word: string }>;
}

/** Entries are stable, so the rendered page is cached at the edge for a day. */
export const revalidate = 86_400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, word } = await params;
  const term = decodeURIComponent(word);
  const language = getLanguage(lang);

  return {
    title: `${term} in ${language?.name ?? lang}`,
    description: `Definitions, pronunciation and examples for ${term} in ${language?.name ?? lang}.`,
  };
}

export default async function EntryPage({ params }: Props) {
  const { lang, word } = await params;
  const term = decodeURIComponent(word).trim();
  const language = getLanguage(lang);

  if (!term || !language) notFound();

  let entry = null;
  let failure: string | null = null;

  try {
    entry = await getDictionaryChain().lookup(term, lang);
  } catch {
    // A provider outage is not a missing word, and the difference matters to
    // the reader, so the two states are rendered differently.
    failure = "The dictionary sources could not be reached just now.";
  }

  if (!entry) {
    return (
      <>
        <div className="runhead">
          <h1 className="runhead__title">No entry</h1>
          <span className="runhead__note">{language.name}</span>
        </div>
        <p className="notice">
          {failure ?? (
            <>
              Nothing found for <strong lang={lang}>{term}</strong> in {language.name}. Wiktionary coverage varies by
              word rather than by language, so a missing entry usually means nobody has written that one yet.
            </>
          )}
        </p>
        <div style={{ marginTop: "var(--wk-s-8)" }}>
          <DictionarySearch initialWord={term} initialLang={lang} />
        </div>
      </>
    );
  }

  const recordings = entry.pronunciations.filter((item) => item.audioUrl);
  const transcriptions = entry.pronunciations.filter((item) => item.ipa);

  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>Dictionary</h1>
        <span className="runhead__note">{language.name} / {entry.script}</span>
      </div>

      <article className="entry">
        <aside className="margin">
          <div className="margin__block">
            <span className="margin__label">Language</span>
            <span className="margin__value">
              <span lang={language.code} dir={language.dir}>{language.native}</span>
              <br />
              {language.name}
            </span>
          </div>

          <div className="margin__block">
            <span className="margin__label">Script</span>
            <span className="margin__value">{entry.script}</span>
          </div>

          <div className="margin__block">
            <span className="margin__label">Direction</span>
            <span className="margin__value">{entry.dir === "rtl" ? "right to left" : "left to right"}</span>
          </div>

          {language.dialects.length > 0 ? (
            <div className="margin__block">
              <span className="margin__label">Dialects</span>
              <span className="margin__value">{language.dialects.map((d) => d.name).join(", ")}</span>
            </div>
          ) : null}

          <div className="stamp">
            {entry.attribution.map((credit) => (
              <div key={credit.source}>
                <a href={credit.url} rel="noreferrer">{credit.source}</a>
                <br />
                {credit.license}
              </div>
            ))}
          </div>
        </aside>

        <div>
          <header className="headword">
            <div>
              {entry.reading ? (
                <span className="headword__ruby" lang={entry.lang}>{entry.reading}</span>
              ) : null}
              <h2 className="headword__word" lang={entry.lang} dir={entry.dir}>{entry.word}</h2>
            </div>
            <div className="headword__tools">
              <SpeakButton text={entry.word} lang={entry.lang} label={`Hear ${entry.word} spoken`} />
            </div>
          </header>

          {transcriptions.length > 0 || recordings.length > 0 ? (
            <div className="pronunciations">
              {transcriptions.slice(0, 3).map((item, index) => (
                <span key={index} className="ipa">
                  <span>{item.ipa}</span>
                  {item.accent ? <span className="ipa__accent">{item.accent}</span> : null}
                </span>
              ))}
              {recordings.slice(0, 4).map((item, index) => (
                <AudioButton
                  key={index}
                  src={item.audioUrl as string}
                  {...(item.accent ? { accent: item.accent } : {})}
                />
              ))}
            </div>
          ) : null}

          <ol className="senses">
            {entry.senses.map((sense, index) => (
              <li key={index} className="sense">
                <div>
                  <span className="sense__pos">{sense.partOfSpeech}</span>
                  <p className="sense__definition">{sense.definition}</p>
                  {sense.examples.map((example, exampleIndex) => (
                    <div key={exampleIndex} className="example">
                      <span className="example__text" lang={entry.lang} dir={entry.dir}>{example.text}</span>
                      {example.translation ? (
                        <span className="example__translation">{example.translation}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <WordSet title="Synonyms" words={entry.synonyms} lang={entry.lang} />
          <WordSet title="Antonyms" words={entry.antonyms} lang={entry.lang} />
          <WordSet title="Other forms" words={entry.forms} lang={entry.lang} />

          {entry.etymology ? (
            <section className="wordset">
              <div className="runhead">
                <h3 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>Origin</h3>
              </div>
              <p className="sense__definition">{entry.etymology}</p>
            </section>
          ) : null}

          <section className="wordset">
            <div className="runhead">
              <h3 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>Look up another</h3>
            </div>
            <DictionarySearch initialLang={entry.lang} />
          </section>
        </div>
      </article>
    </>
  );
}

function WordSet({ title, words, lang }: { title: string; words: string[]; lang: string }) {
  if (words.length === 0) return null;

  return (
    <section className="wordset">
      <div className="runhead">
        <h3 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>{title}</h3>
        <span className="runhead__note">{words.length}</span>
      </div>
      <div className="wordset__list">
        {words.slice(0, 24).map((item) => (
          <Link key={item} href={`/dictionary/${lang}/${encodeURIComponent(item)}`} className="wordset__item" lang={lang}>
            {item}
          </Link>
        ))}
      </div>
    </section>
  );
}
