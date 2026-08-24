"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCRIPT_LABELS, SCRIPT_TO_LANG, recognizePage, type OcrPage, type OcrProgress, type SourceScript } from "@wakaru/ocr";
import { LanguageCombobox } from "./LanguageCombobox";

type Mode = "outline" | "filled";

interface Translated {
  id: string;
  text: string;
}

const SCRIPTS: SourceScript[] = ["japanese", "korean", "chinese-simplified", "chinese-traditional", "english"];

const STAGE_LABEL: Record<OcrProgress["stage"], string> = {
  "loading-model": "Downloading the language model",
  "detecting-bubbles": "Finding speech bubbles",
  reading: "Reading",
  done: "Done",
};

export function MangaReader() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [script, setScript] = useState<SourceScript>("japanese");
  const [target, setTarget] = useState("en");
  const [mode, setMode] = useState<Mode>("outline");

  const [page, setPage] = useState<OcrPage | null>(null);
  const [translated, setTranslated] = useState<Translated[]>([]);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Revoke the object URL when the page is replaced, otherwise every dropped
  // image stays in memory for the life of the tab.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const accept = useCallback((file: File | null | undefined) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("That is not an image file.");
      return;
    }
    setError(null);
    setPage(null);
    setTranslated([]);
    setProgress(null);
    setImageUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  }, []);

  // Paste is how most people actually get a page out of a reader tab.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const file = [...(event.clipboardData?.files ?? [])][0];
      if (file) accept(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [accept]);

  async function run() {
    const image = imgRef.current;
    if (!image || !imageSize) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError(null);
    setTranslated([]);

    try {
      const result = await recognizePage(image, imageSize.width, imageSize.height, {
        script,
        detectBubbles: true,
        onProgress: setProgress,
        signal: controller.signal,
      });

      setPage(result);

      if (result.regions.length === 0) {
        /*
         * Two very different outcomes, and saying "no text found" for both is
         * wrong. Nothing detected means the artwork gave the detector nothing
         * to work with. Plenty detected but nothing readable means the regions
         * were found and the recogniser could not make them out, which is
         * worth telling someone, because a bigger or cleaner scan usually
         * fixes it.
         */
        setError(
          result.detected > 0
            ? `Found ${result.detected} text ${result.detected === 1 ? "region" : "regions"}, but none could be read confidently. A larger or cleaner scan usually helps.`
            : "No text regions were found on this page.",
        );
        return;
      }

      await translateRegions(result, controller.signal);
    } catch {
      setError("Could not read this page.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function translateRegions(result: OcrPage, signal: AbortSignal) {
    const from = SCRIPT_TO_LANG[script];

    // One request per bubble keeps each translation in its own context, which
    // matters because neighbouring bubbles are usually different speakers.
    const results = await Promise.all(
      result.regions.map(async (region) => {
        try {
          const response = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: region.text, from, to: target }),
            signal,
          });
          if (!response.ok) return { id: region.id, text: "" };
          const payload = await response.json();
          return { id: region.id, text: typeof payload?.text === "string" ? payload.text : "" };
        } catch {
          return { id: region.id, text: "" };
        }
      }),
    );

    setTranslated(results);
    setMode("filled");
  }

  const textFor = (id: string) => translated.find((item) => item.id === id)?.text ?? "";

  return (
    <div className="table wk-scope">
      <div className="table__controls">
        <div className="table__control">
          <span className="wk-caps" style={{ display: "block", marginBottom: "var(--wk-s-1)" }}>
            Page is written in
          </span>
          <div className="dialects">
            {SCRIPTS.map((option) => (
              <button
                key={option}
                type="button"
                className="wk-chip"
                data-selected={script === option}
                aria-pressed={script === option}
                onClick={() => { setScript(option); setPage(null); setTranslated([]); }}
              >
                {SCRIPT_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="table__control">
          <LanguageCombobox label="Translate into" value={target} onChange={setTarget} />
        </div>

        <div className="table__spacer" />

        {page && page.regions.length > 0 ? (
          <label className="wk-toggle">
            <input
              type="checkbox"
              className="wk-toggle__input"
              checked={mode === "filled"}
              onChange={(event) => setMode(event.target.checked ? "filled" : "outline")}
            />
            <span className="wk-toggle__track">
              <span className="wk-toggle__knob" />
            </span>
            <span className="wk-toggle__state">{mode === "filled" ? "translated" : "raw"}</span>
          </label>
        ) : null}

        <button
          type="button"
          className="wk-btn wk-btn--seal"
          onClick={() => void run()}
          disabled={!imageUrl || busy}
        >
          {busy ? "Reading" : "Read this page"}
        </button>
      </div>

      {!imageUrl ? (
        <label
          className="dropzone"
          data-over={over}
          onDragOver={(event) => { event.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            accept(event.dataTransfer.files[0]);
          }}
        >
          <span className="dropzone__title">Drop a page here</span>
          <span className="dropzone__hint">
            Drag an image in, paste one from the clipboard, or choose a file. Everything runs in this browser: the
            page is never uploaded anywhere.
          </span>
          <span className="wk-btn wk-btn--sm">Choose a file</span>
          <input
            type="file"
            accept="image/*"
            className="wk-sr-only"
            onChange={(event) => accept(event.target.files?.[0])}
          />
        </label>
      ) : (
        <div className="plate">
          {/* A plain img rather than next/image: the source is an object URL
              for a local file, so there is nothing for the optimiser to do. */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="The manga page being read"
            onLoad={(event) => {
              const element = event.currentTarget;
              setImageSize({ width: element.naturalWidth, height: element.naturalHeight });
            }}
          />

          {page?.regions.map((region, index) => {
            const output = textFor(region.id);
            const showFilled = mode === "filled" && output.length > 0;

            return (
              <div
                key={region.id}
                className="bubble"
                data-mode={showFilled ? "filled" : "outline"}
                title={showFilled ? region.text : output || region.text}
                style={{
                  left: `${(region.box.x / page.width) * 100}%`,
                  top: `${(region.box.y / page.height) * 100}%`,
                  width: `${(region.box.width / page.width) * 100}%`,
                  height: `${(region.box.height / page.height) * 100}%`,
                }}
              >
                <span className="bubble__index" aria-hidden="true">{index + 1}</span>
                {showFilled ? (
                  <span
                    className="bubble__text"
                    style={{ fontSize: `clamp(8px, ${Math.max(9, region.box.height / 7)}px, 20px)` }}
                  >
                    {output}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {busy && progress ? (
        <div className="progress" role="status" aria-live="polite">
          <span>
            {STAGE_LABEL[progress.stage]}
            {progress.region ? ` bubble ${progress.region} of ${progress.total}` : ""}
          </span>
          <span className="progress__bar">
            <span className="progress__fill" style={{ width: `${Math.round(progress.value * 100)}%` }} />
          </span>
        </div>
      ) : null}

      {error ? (
        <p className="progress" role="alert" style={{ borderColor: "#e4553f" }}>
          {error}
        </p>
      ) : null}

      {page && page.regions.length > 0 ? (
        <section className="transcript">
          <div className="runhead">
            <h2 className="runhead__title" style={{ fontSize: "var(--wk-t-lg)" }}>Transcript</h2>
            <span className="runhead__note">
              {page.regions.length} of {page.detected} read in {(page.elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>

          {page.regions.map((region, index) => (
            <div key={region.id} className="panelrow">
              <span className="panelrow__num">{index + 1}</span>
              <span className="panelrow__raw" lang={SCRIPT_TO_LANG[script]}>{region.text}</span>
              <span className="panelrow__out" lang={target}>
                {textFor(region.id) || <em style={{ color: "var(--wk-text-muted)" }}>not translated</em>}
              </span>
              <span className="panelrow__meta">
                {region.vertical ? "vertical text" : "horizontal text"} / confidence {Math.round(region.confidence)}
              </span>
            </div>
          ))}
        </section>
      ) : null}
      {imageUrl ? (
        <div style={{ marginTop: "var(--wk-s-4)" }}>
          <button
            type="button"
            className="wk-btn wk-btn--sm wk-btn--quiet"
            onClick={() => {
              abortRef.current?.abort();
              setImageUrl(null);
              setPage(null);
              setTranslated([]);
              setError(null);
            }}
          >
            Use a different page
          </button>
        </div>
      ) : null}
    </div>
  );
}
