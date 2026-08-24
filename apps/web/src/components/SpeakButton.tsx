"use client";

import { useState } from "react";
import { speak, stopSpeaking } from "@wakaru/core";

export interface SpeakButtonProps {
  text: string;
  lang: string;
  size?: "sm" | "md";
  label?: string;
}

/**
 * The seal doubles as the play control.
 *
 * Web Speech uses whatever voices the operating system has, so a dialect the
 * machine cannot speak is a real and common outcome. Rather than silently
 * reading Mexican Spanish in a Castilian voice, the button says which voice it
 * actually used, or that there is none.
 */
export function SpeakButton({ text, lang, size = "md", label }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function onPlay() {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }

    setStatus(null);
    setSpeaking(true);

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
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--wk-s-2)" }}>
      <button
        type="button"
        className={size === "sm" ? "wk-seal-btn wk-seal-btn--sm" : "wk-seal-btn"}
        onClick={onPlay}
        disabled={!text.trim()}
        aria-pressed={speaking}
        title={label ?? `Hear this in ${lang}`}
      >
        <span aria-hidden="true">{speaking ? "■" : "▶"}</span>
        <span className="wk-sr-only">{speaking ? "Stop speaking" : `Hear this read aloud in ${lang}`}</span>
      </button>
      {status ? (
        <span className="wk-caps" role="status" style={{ textTransform: "none", letterSpacing: "0.02em" }}>
          {status}
        </span>
      ) : null}
    </span>
  );
}
