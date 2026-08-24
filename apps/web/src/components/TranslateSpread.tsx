"use client";

import { useMemo, useRef, useState } from "react";
import { LANGUAGES, dialectsFor, directionOf, escapeRegExp, type TranslationResult } from "@wakaru/core";
import { LanguageCombobox } from "./LanguageCombobox";
import { SpeakButton } from "./SpeakButton";
import { CopyButton } from "./CopyButton";

const MAX_CHARS = 5_000;

/**
 * Highlight the words the dialect overlay rewrote.
 *
 * Showing the change is the point of the feature. A reader should be able to
 * see that "ordenador" became "computadora" and decide whether they agree,
 * rather than being handed a result with invisible edits inside it.
 */
function markEdits(text: string, edits: TranslationResult["dialectEdits"]) {
  if (edits.length === 0) return text;

  const terms = [...new Set(edits.map((edit) => edit.to))].filter(Boolean).sort((a, b) => b.length - a.length);
  if (terms.length === 0) return text;

  const noteFor = new Map(edits.map((edit) => [edit.to, edit]));
  const pattern = new RegExp("(" + terms.map(escapeRegExp).join("|") + ")", "gu");

  return text.split(pattern).map((piece, index) => {
    const edit = noteFor.get(piece);
    if (!edit) return piece;
    return (
      <mark
        key={piece + index}
        className="edit"
        title={edit.note ? `was "${edit.from}". ${edit.note}` : `was "${edit.from}"`}
      >
        {piece}
      </mark>
    );
  });
}

export function TranslateSpread() {
  const [source, setSource] = useState("en");
  const [target, setTarget] = useState("ja");
  const [dialect, setDialect] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef<AbortController | null>(null);

  const targetDialects = useMemo(() => dialectsFor(target), [target]);
  const effectiveTarget = dialect ?? target;
  const targetDir = directionOf(effectiveTarget);
  const sourceDir = source === "auto" ? "ltr" : directionOf(source);

  const over = text.length > MAX_CHARS;

  async function run() {
    if (!text.trim() || over) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, from: source, to: target, dialect }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(typeof payload?.error === "string" ? payload.error : "translation failed");
        setResult(null);
        return;
      }

      setResult(payload as TranslationResult);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("could not reach the translator");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }

  function swap() {
    if (source === "auto") return;
    const previousTarget = target;
    setTarget(source);
    setSource(previousTarget);
    setDialect(null);
    setText(result?.text ?? text);
    setResult(null);
  }

  return (
    <>
      <div className="spread">
        {/* --------------------------------------------------- source page */}
        <section className="leaf" aria-label="Source text">
          <div className="leaf__head">
            <LanguageCombobox
              label="From"
              value={source}
              onChange={(code) => { setSource(code); setResult(null); }}
              allowAuto
            />
          </div>

          <div className="dialects" aria-hidden="true" />

          <textarea
            className="wk-field wk-field--grid composer"
            value={text}
            dir={sourceDir}
            lang={source === "auto" ? undefined : source}
            placeholder="Write or paste anything here."
            aria-label="Text to translate"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                event.preventDefault();
                void run();
              }
            }}
          />

          <div className="leaf__foot">
            <SpeakButton text={text} lang={source === "auto" ? "en" : source} size="sm" />
            <button
              type="button"
              className="wk-btn wk-btn--sm wk-btn--quiet"
              onClick={() => { setText(""); setResult(null); }}
              disabled={!text}
            >
              Clear
            </button>
            <span className={over ? "counter counter--over" : "counter"}>
              {text.length} / {MAX_CHARS}
            </span>
          </div>
        </section>

        {/* --------------------------------------------------------- spine */}
        <div className="gutter">
          <button
            type="button"
            className="wk-seal-btn"
            onClick={() => void run()}
            disabled={busy || !text.trim() || over}
            title="Translate. Ctrl and Enter also works."
          >
            <span aria-hidden="true" style={{ fontFamily: "var(--wk-font-display)" }}>訳</span>
            <span className="wk-sr-only">Translate</span>
          </button>

          <button
            type="button"
            className="wk-btn wk-btn--sm wk-btn--quiet"
            onClick={swap}
            disabled={source === "auto"}
            title={source === "auto" ? "Pick a source language before swapping" : "Swap the two languages"}
          >
            <span aria-hidden="true">⇄</span>
            <span className="wk-sr-only">Swap languages</span>
          </button>
        </div>

        {/* --------------------------------------------------- target page */}
        <section className="leaf leaf--target" aria-label="Translation">
          <div className="leaf__head">
            <LanguageCombobox
              label="Into"
              value={target}
              onChange={(code) => { setTarget(code); setDialect(null); setResult(null); }}
            />
          </div>

          <div className="dialects">
            {targetDialects.length > 0 ? (
              <>
                <button
                  type="button"
                  className="wk-chip"
                  data-selected={dialect === null}
                  aria-pressed={dialect === null}
                  onClick={() => { setDialect(null); setResult(null); }}
                >
                  Standard
                </button>
                {targetDialects.map((entry) => (
                  <button
                    key={entry.code}
                    type="button"
                    className="wk-chip"
                    data-selected={dialect === entry.code}
                    aria-pressed={dialect === entry.code}
                    title={entry.summary}
                    onClick={() => { setDialect(entry.code); setResult(null); }}
                  >
                    {entry.name}
                  </button>
                ))}
              </>
            ) : (
              <span className="wk-caps">No dialect data for this language yet</span>
            )}
          </div>

          <div
            className={busy ? "rendered wk-loading" : "rendered"}
            dir={targetDir}
            lang={effectiveTarget}
            data-placeholder={busy ? "Working." : "The translation appears here."}
            aria-live="polite"
            aria-busy={busy}
          >
            {result ? markEdits(result.text, result.dialectEdits) : null}
          </div>

          <div className="leaf__foot">
            <SpeakButton text={result?.text ?? ""} lang={effectiveTarget} size="sm" />
            <CopyButton text={result?.text ?? ""} />
          </div>
        </section>
      </div>

      <Ledger result={result} error={error} busy={busy} />
    </>
  );
}

/**
 * The line under the spread that says where the result came from.
 *
 * With a chain of free providers, which one answered and whether it fell back
 * is real information, not debug output, so it is shown rather than hidden.
 */
function Ledger({ result, error, busy }: { result: TranslationResult | null; error: string | null; busy: boolean }) {
  if (error) {
    return (
      <p className="notice" role="alert">
        {error}
      </p>
    );
  }

  if (!result) {
    return busy ? null : (
      <p className="notice notice--quiet">
        Translation runs when you press the seal, not as you type. Every source here is free and rate limited, so
        requests are spent deliberately.
      </p>
    );
  }

  const detectedName = LANGUAGES.find((language) => language.code === result.detectedFrom)?.name;

  return (
    <>
      {result.lossyNote ? (
        <p className="notice" role="note">
          <strong>This script conversion is an approximation.</strong> {result.lossyNote}
        </p>
      ) : null}

      <div className="ledger">
        <span className="ledger__stamp">{result.provider}</span>
        {result.cached ? <span>served from cache</span> : null}
        {result.fellBackFrom.length > 0 ? <span>after {result.fellBackFrom.join(", ")} failed</span> : null}
        {result.detectedFrom ? <span>detected {detectedName ?? result.detectedFrom}</span> : null}
        {typeof result.match === "number" && result.match < 0.8 ? (
          <span>provider confidence {Math.round(result.match * 100)} percent</span>
        ) : null}
      </div>

      {result.dialectEdits.length > 0 ? (
        <section className="edits">
          <div className="runhead">
            <h2 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>
              What the dialect layer changed
            </h2>
            <span className="runhead__note">
              {result.dialectEdits.length} {result.dialectEdits.length === 1 ? "edit" : "edits"}
            </span>
          </div>
          <ul className="edits__list">
            {result.dialectEdits.map((edit, index) => (
              <li key={edit.from + index} className="edits__row">
                <span className="edits__from">{edit.from}</span>
                <span aria-hidden="true">to</span>
                <span className="edits__to">{edit.to}</span>
                <span className="edits__conf">{edit.confidence} confidence</span>
                {edit.note ? <span className="edits__note">{edit.note}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
