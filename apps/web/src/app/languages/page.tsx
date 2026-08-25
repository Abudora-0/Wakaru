import type { Metadata } from "next";
import Link from "next/link";
import { DIALECTS, LANGUAGES, piperVoiceFor, totalDialectCount, voiceLikelihood } from "@wakaru/core";
import "./languages.css";

export const metadata: Metadata = {
  title: "Languages",
  description:
    "Every language and dialect Wakaru covers, shown as a type specimen so you can see your own script render before you rely on it.",
};

type Lang = (typeof LANGUAGES)[number];

export default function LanguagesPage() {
  const families = new Map<string, Lang[]>();
  for (const language of LANGUAGES) {
    const list = families.get(language.family) ?? [];
    list.push(language);
    families.set(language.family, list);
  }

  const ordered = [...families.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <>
      <div className="runhead">
        <h1 className="runhead__title">Languages</h1>
        <span className="runhead__note">
          {LANGUAGES.length} languages / {totalDialectCount()} dialects
        </span>
      </div>

      <p className="notice notice--quiet" style={{ marginBottom: "var(--wk-s-8)" }}>
        Coverage is not uniform and this page does not pretend otherwise. Translation reaches roughly a hundred
        languages through the free providers. Dictionary coverage comes from Wiktionary and varies by word rather than
        by language. Dialects are curated by hand in this repository, because no free API exposes them, so that list
        grows by contribution rather than automatically.
      </p>

      <div className="specimen">
        {ordered.map(([family, languages]) => (
          <section key={family} className="family">
            <div className="family__head">
              <h2 className="family__title">{family}</h2>
              <span className="family__count">{languages.length}</span>
            </div>

            <div className="slugs">
              {languages.map((language) => (
                <Link key={language.code} href={`/dictionary/${language.code}`} className="slug">
                  <span className="slug__glyph" lang={language.code} aria-hidden="true">
                    {language.sample}
                  </span>
                  <span>
                    <span className="slug__native" lang={language.code} dir={language.dir}>
                      {language.native}
                    </span>
                    <span className="slug__name">
                      {language.name} / {language.code} / {language.script}
                    </span>
                    {language.dialects.length > 0 ? (
                      <span className="slug__dialects">
                        {language.dialects.length} {language.dialects.length === 1 ? "dialect" : "dialects"}
                      </span>
                    ) : null}
                    <VoiceMark lang={language.code} />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <DialectRegister />
    </>
  );
}

/**
 * The dialect register.
 *
 * Listed in full, with what each entry actually does, because "supports
 * dialects" means nothing without showing the rules behind it.
 */
function DialectRegister() {
  return (
    <section style={{ marginTop: "var(--wk-s-16)" }}>
      <div className="runhead">
        <h2 className="runhead__title">The dialect register</h2>
        <span className="runhead__note">{DIALECTS.length} entries</span>
      </div>

      <div className="tablewrap">
        <table className="ledger-table">
          <thead>
            <tr>
              <th scope="col">Tag</th>
              <th scope="col">Dialect</th>
              <th scope="col">Region</th>
              <th scope="col">What it changes</th>
              <th scope="col">Rules</th>
            </tr>
          </thead>
          <tbody>
            {DIALECTS.map((dialect) => {
              const rules = [
                dialect.lexicon ? `${dialect.lexicon.length} words` : null,
                dialect.orthography ? `${dialect.orthography.length} spelling rules` : null,
                dialect.transliterate ? "script conversion" : null,
              ].filter(Boolean);

              return (
                <tr key={dialect.code}>
                  <td>
                    <code>{dialect.code}</code>
                  </td>
                  <td>
                    <strong>{dialect.name}</strong>
                    <br />
                    <span lang={dialect.base} dir={dialect.dir ?? "ltr"}>
                      {dialect.native}
                    </span>
                  </td>
                  <td>{dialect.region}</td>
                  <td>{dialect.summary}</td>
                  <td>{rules.length > 0 ? rules.join(", ") : "locale routing only"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Whether a reader is likely to be able to hear this language.
 *
 * Speech comes from voices the operating system provides, so this is a
 * prediction rather than a fact, and it is labelled as one. Saying it here
 * means nobody has to press a play button on forty languages to find out.
 */
function VoiceMark({ lang }: { lang: string }) {
  /*
   * A downloadable neural voice is a promise rather than a prediction: it does
   * not depend on the reader's operating system, on which voices they have
   * installed, or on a privacy blocker hiding the list. So it outranks any
   * guess about device coverage.
   */
  if (piperVoiceFor(lang)) {
    return (
      <span className="slug__voice" data-level="wide" title="Runs in your browser, downloaded once">
        Voice
      </span>
    );
  }

  const likelihood = voiceLikelihood(lang);

  if (likelihood === "wide") {
    return (
      <span className="slug__voice" data-level="device" title="Uses a voice from your operating system">
        Voice, if installed
      </span>
    );
  }
  if (likelihood === "common") {
    return (
      <span className="slug__voice" data-level="common" title="Some platforms ship one, many do not">
        Voice, sometimes
      </span>
    );
  }
  return <span className="slug__voice" data-level="rare">No voice</span>;
}
