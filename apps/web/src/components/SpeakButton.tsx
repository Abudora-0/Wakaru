"use client";

import { useEffect, useRef, useState } from "react";
import { loadVoices, matchVoice, piperVoiceFor, speak, stopSpeaking, PIPER_MODEL_MB } from "@wakaru/core";
import { isVoiceReady, synthesise } from "@/lib/piper";

export interface SpeakButtonProps {
  text: string;
  lang: string;
  size?: "sm" | "md";
  label?: string;
}

type Route = "device" | "piper" | "none";

/**
 * The seal doubles as the play control.
 *
 * Three routes, tried in order, and the reader is told which one answered:
 *
 *   device  a system voice exists. Instant, nothing to download.
 *   piper   no system voice, but a neural model can be fetched and run here.
 *           Roughly 60 MB the first time, then cached and offline.
 *   none    neither. Said plainly rather than played as silence.
 *
 * The route is worked out when the language changes, not when the button is
 * pressed, so a download is something a reader agrees to rather than something
 * that starts under them.
 */
export function SpeakButton({ text, lang, size = "md", label }: SpeakButtonProps) {
  const [route, setRoute] = useState<Route | null>(null);
  const [ready, setReady] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setProgress(null);

    void (async () => {
      const voices = await loadVoices();
      if (cancelled) return;

      if (matchVoice(voices, lang)) {
        setRoute("device");
        setReady(true);
        return;
      }

      if (piperVoiceFor(lang)) {
        setRoute("piper");
        setReady(await isVoiceReady(lang));
        return;
      }

      setRoute("none");
      setReady(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [lang]);

  // Object URLs and audio elements outlive the component unless released.
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      releaseRef.current?.();
      stopSpeaking();
    };
  }, []);

  function stop() {
    audioRef.current?.pause();
    stopSpeaking();
    setSpeaking(false);
  }

  async function play() {
    if (speaking) {
      stop();
      return;
    }

    setStatus(null);
    setSpeaking(true);

    if (route === "device") {
      const outcome = await speak(text, lang, {
        onEnd: () => setSpeaking(false),
        onError: (reason) => {
          setSpeaking(false);
          setStatus(reason);
        },
      });
      if (!outcome.spoken) {
        setSpeaking(false);
        setStatus(outcome.unavailable ?? "could not speak that");
      } else if (outcome.approximate) {
        setStatus(outcome.approximate);
      }
      return;
    }

    try {
      const result = await synthesise(text, lang, (p) => setProgress(p.value));
      setProgress(null);
      setReady(true);

      releaseRef.current?.();
      releaseRef.current = result.release;

      const audio = new Audio(result.url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => setSpeaking(false));
      audio.addEventListener("error", () => {
        setSpeaking(false);
        setStatus("the voice could not be played");
      });
      await audio.play();
    } catch {
      setSpeaking(false);
      setProgress(null);
      setStatus("the voice could not be downloaded");
    }
  }

  const unavailable = route === "none";
  const disabled = !text.trim() || unavailable || route === null;

  const hint =
    progress !== null
      ? `downloading the voice, ${Math.round(progress * 100)} percent`
      : unavailable
        ? "no voice is available for this language"
        : status;

  const title = unavailable
    ? `No voice for ${lang}`
    : route === "piper" && !ready
      ? `Download a ${PIPER_MODEL_MB} MB voice for ${lang}, once, then it works offline`
      : (label ?? `Hear this in ${lang}`);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--wk-s-2)", minWidth: 0 }}>
      <button
        type="button"
        className={size === "sm" ? "wk-seal-btn wk-seal-btn--sm" : "wk-seal-btn"}
        onClick={() => void play()}
        disabled={disabled}
        aria-pressed={speaking}
        title={title}
        data-route={route ?? undefined}
      >
        <span aria-hidden="true">
          {unavailable ? "\u2014" : speaking ? "\u25a0" : route === "piper" && !ready ? "\u2193" : "\u25b6"}
        </span>
        <span className="wk-sr-only">
          {unavailable
            ? `No voice available for ${lang}`
            : speaking
              ? "Stop"
              : route === "piper" && !ready
                ? `Download a voice for ${lang} and read this aloud`
                : `Hear this read aloud in ${lang}`}
        </span>
      </button>

      {hint ? (
        <span
          className="wk-caps"
          role="status"
          title={hint}
          style={{ textTransform: "none", letterSpacing: "0.02em", maxWidth: "40ch", lineHeight: 1.4 }}
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}
