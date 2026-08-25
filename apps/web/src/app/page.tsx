import type { Metadata } from "next";
import Link from "next/link";
import { DIALECTS, LANGUAGES } from "@wakaru/core";
import { Logo } from "@/components/Logo";
import "./landing.css";

export const metadata: Metadata = {
  title: "Wakaru",
  description:
    "Translate between languages and their regional dialects, look a word up in any script with pronunciation and examples, and read raw manga in your browser. No API keys, no accounts.",
};

/**
 * The front page.
 *
 * Deliberately not the translator. Landing straight in a tool tells a first
 * time reader nothing about the dialect layer, the dictionary or the reader,
 * and those are the parts worth knowing about. Each strip below shows a real
 * worked example rather than describing a feature, because the difference
 * between "supports dialects" and watching auto become carro is the point.
 */
export default function LandingPage() {
  return (
    <>
      <section className="cover">
        <div className="cover__type">
          <p className="cover__eyebrow">Translate / Define / Read</p>

          <h1 className="cover__title">
            <span className="cover__ruby" lang="ja" aria-hidden="true">わかる</span>
            Understand
            <br />
            anything you read.
          </h1>

          <p className="cover__lede">
            A translator that knows the difference between Mexican and Peninsular Spanish, a dictionary that speaks{" "}
            {LANGUAGES.length} languages, and a reader that turns a raw manga page into text without uploading it
            anywhere. Every source is free and keyless.
          </p>

          <div className="cover__actions">
            <Link href="/translate" className="wk-btn wk-btn--seal wk-btn--lg">
              Start translating
            </Link>
            <Link href="/read" className="wk-btn wk-btn--lg">
              Read a raw page
            </Link>
          </div>

          <div className="cover__stats">
            <div className="stat">
              <span className="stat__figure">{LANGUAGES.length}</span>
              <span className="stat__label">Languages</span>
            </div>
            <div className="stat">
              <span className="stat__figure">{DIALECTS.length}</span>
              <span className="stat__label">Curated dialects</span>
            </div>
            <div className="stat">
              <span className="stat__figure">0</span>
              <span className="stat__label">API keys needed</span>
            </div>
            <div className="stat">
              <span className="stat__figure">MIT</span>
              <span className="stat__label">Licence</span>
            </div>
          </div>
        </div>

        <div className="cover__plate">
          <Logo size={320} title="Wakaru" />
          <div className="cover__scripts" aria-hidden="true">
            <span lang="ja">日</span>
            <span lang="ko">한</span>
            <span lang="zh">中</span>
            <span lang="ar">ع</span>
            <span lang="hi">अ</span>
          </div>
        </div>
      </section>

      <div className="strips">
        <Link href="/translate" className="strip">
          <span className="strip__number" aria-hidden="true">1</span>
          <div className="strip__body">
            <h2 className="strip__title">Dialects, not just languages</h2>
            <p className="strip__text">
              Ask for Mexican Spanish and the result is rewritten to match, with every substitution listed underneath
              and a reason attached. Nothing is changed invisibly, so you can disagree with it.
            </p>
            <span className="strip__more">Open the translator</span>
          </div>
          <div className="strip__demo">
            <div className="demo__row">
              <span className="demo__label">English</span>
              <span className="demo__value">I need a computer and a car.</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">es</span>
              <span className="demo__value" lang="es">Necesito una computadora y un auto.</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">es-MX</span>
              <span className="demo__value" lang="es-MX">
                Necesito una computadora y un <mark>carro</mark>.
              </span>
            </div>
            <p className="demo__note">auto is Rioplatense, Mexico says carro</p>
          </div>
        </Link>

        <Link href="/dictionary" className="strip">
          <span className="strip__number" aria-hidden="true">2</span>
          <div className="strip__body">
            <h2 className="strip__title">A dictionary in any script</h2>
            <p className="strip__text">
              Definitions, phonetics, recordings by real speakers, synonyms and example sentences, merged from several
              sources into one entry with every licence credited in the margin.
            </p>
            <span className="strip__more">Look up a word</span>
          </div>
          <div className="strip__demo">
            <div className="demo__row">
              <span className="demo__label">Headword</span>
              <span className="demo__value">serendipity</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">Phonetic</span>
              <span className="demo__value demo__ipa">/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">猫</span>
              <span className="demo__value" lang="ja">a cat</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">کتاب</span>
              <span className="demo__value" lang="ur" dir="rtl">book, manuscript, volume</span>
            </div>
            <p className="demo__note">Right to left scripts render right to left, throughout</p>
          </div>
        </Link>

        <Link href="/read" className="strip">
          <span className="strip__number" aria-hidden="true">3</span>
          <div className="strip__body">
            <h2 className="strip__title">Read a raw page</h2>
            <p className="strip__text">
              Speech bubbles are found, read and translated in your own browser. The page is never uploaded: only the
              recognised text leaves your machine. A browser extension does the same on any site you are already
              reading.
            </p>
            <span className="strip__more">Open the reader</span>
          </div>
          <div className="strip__demo">
            <div className="demo__row">
              <span className="demo__label">Detected</span>
              <span className="demo__value" lang="ko">감히 외지인을 구슬려 우리 샤프트파를 신고해?</span>
            </div>
            <div className="demo__row">
              <span className="demo__label">English</span>
              <span className="demo__value">How dare you coax an outsider into reporting our Shaft gang?</span>
            </div>
            <p className="demo__note">Japanese, Korean and Chinese, including vertical text</p>
          </div>
        </Link>
      </div>

      <section className="plainly">
        <h2 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>
          Plainly
        </h2>
        <div className="plainly__grid">
          <div className="plainly__item">
            <h3>What it costs</h3>
            <p>
              Nothing, and there is no account. Every provider works anonymously, which is also why translation runs
              when you press the seal rather than as you type.
            </p>
          </div>
          <div className="plainly__item">
            <h3>What it cannot do</h3>
            <p>
              Dialect coverage is {DIALECTS.length} entries written by hand, not every dialect of every language. No
              free API exposes dialects at all, so this part grows by contribution.
            </p>
          </div>
          <div className="plainly__item">
            <h3>Where the words come from</h3>
            <p>
              Wiktionary, dictionaryapi.dev, Lingua Libre, MyMemory and Datamuse. Each entry names its sources and
              their licences, because CC BY-SA requires it.
            </p>
          </div>
          <div className="plainly__item">
            <h3>Run it yourself</h3>
            <p>
              The whole thing is MIT licensed, and one Docker command swaps in your own translation server so no
              request leaves your network.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
