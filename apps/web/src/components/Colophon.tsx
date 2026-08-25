import Link from "next/link";
import { DIALECTS, LANGUAGES } from "@wakaru/core";
import { Logo } from "./Logo";

const REPO = "https://github.com/Abudora-0/Wakaru";

/**
 * The back matter.
 *
 * Set as the end of a printed book rather than as a row of links: an imprint,
 * the contents in columns, and a real colophon naming what the thing is set
 * in. The sources column is not decoration either, it carries the licence for
 * every body of data the site displays, which Wiktionary's CC BY-SA requires.
 */

const PRODUCT = [
  { href: "/translate", label: "Translate" },
  { href: "/dictionary", label: "Dictionary" },
  { href: "/read", label: "Read raw pages" },
  { href: "/languages", label: "Languages" },
] as const;

const SOURCES = [
  { href: "https://en.wiktionary.org", label: "Wiktionary", licence: "CC BY-SA 4.0" },
  { href: "https://dictionaryapi.dev", label: "dictionaryapi.dev", licence: "CC BY-SA 3.0" },
  { href: "https://lingualibre.org", label: "Lingua Libre", licence: "CC BY-SA 4.0" },
  { href: "https://mymemory.translated.net", label: "MyMemory", licence: "Free tier" },
  { href: "https://www.datamuse.com/api/", label: "Datamuse", licence: "Free for public use" },
] as const;

const PROJECT = [
  { href: REPO, label: "Source on GitHub" },
  { href: `${REPO}/blob/main/LICENSE`, label: "MIT licence" },
  { href: `${REPO}/blob/main/CONTRIBUTING.md`, label: "Contributing" },
  { href: `${REPO}#reading-raw-manga`, label: "Browser extension" },
] as const;

export function Colophon() {
  const dialectCount = DIALECTS.length;

  return (
    <footer className="colophon">
      <div className="shell">
        <div className="colophon__top">
          <div className="imprint">
            <div className="imprint__mark">
              <Logo size={36} />
              <span className="imprint__name">Wakaru</span>
            </div>

            <p className="imprint__blurb">
              Translate between {LANGUAGES.length} languages and {dialectCount} regional dialects, look a word up in
              any script, and read a raw page without leaving your browser.
            </p>

            <span className="imprint__seal">No API keys</span>
          </div>

          <nav className="column" aria-labelledby="colophon-product">
            <h2 className="column__head" id="colophon-product">The site</h2>
            <ul className="column__list">
              {PRODUCT.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="column" aria-labelledby="colophon-sources">
            <h2 className="column__head" id="colophon-sources">Sources</h2>
            <ul className="column__list">
              {SOURCES.map((item) => (
                <li key={item.href}>
                  <a href={item.href} rel="noreferrer">{item.label}</a>
                  <span className="column__licence">{item.licence}</span>
                </li>
              ))}
            </ul>
          </section>

          <nav className="column" aria-labelledby="colophon-project">
            <h2 className="column__head" id="colophon-project">Project</h2>
            <ul className="column__list">
              {PROJECT.map((item) => (
                <li key={item.href}>
                  <a href={item.href} rel="noreferrer">{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="colophon__bottom">
          <span>Wakaru, MIT licensed</span>
          <span>Definitions and recordings remain under the licences named above</span>
          <span className="colophon__setin">
            Set in Zen Antique, Newsreader and Zen Kaku Gothic New. Phonetics in Gentium Plus.
          </span>
        </div>
      </div>
    </footer>
  );
}
