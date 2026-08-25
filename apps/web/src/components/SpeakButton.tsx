"use client";

import { useEffect, useState } from "react";
import { loadVoices, matchVoice, speak, stopSpeaking, voiceAvailability, type VoiceAvailability } from "@wakaru/core";

export interface SpeakButtonProps {
  text: string;
  lang: string;
  size?: "sm" | "md";
  label?: string;
}

/**
 * The seal doubles as the play control.
 *
 * Availability is worked out when the language changes rather than when the
 * button is pressed, because "no voice for this language" is something a
 * reader should learn before reaching for a control, not after hearing
 * silence. Where a voice is merely unlikely the button still works, since the
 * browser can often approximate, and only a language the platform genuinely
 * does not speak is disabled outright.
 */
export function SpeakButton({ text, lang, size = "md", label }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [availability, setAvailability] = useState<VoiceAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadVoices().then((voices) => {
      if (cancelled) return;
      setAvailability(voiceAvailability(lang, voices, matchVoice(voices, lang) !== null));
    });

    return () => {
      cancelled = true;
    };
  }, [lang]);

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

  const unavailable = availability?.offer === false;
  const disabled = !text.trim() || unavailable;

  // Before the voice list resolves, say nothing rather than guess.
  const hint = unavailable ? availability?.reason : status;

  const title = unavailable
    ? `No voice for ${lang} on this device`
    : (label ?? `Hear this in ${lang}`);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--wk-s-2)", minWidth: 0 }}>
      <button
        type="button"
        className={size === "sm" ? "wk-seal-btn wk-seal-btn--sm" : "wk-seal-btn"}
        onClick={onPlay}
        disabled={disabled}
        aria-pressed={speaking}
        title={title}
      >
        <span aria-hidden="true">{unavailable ? "\u2014" : speaking ? "\u25a0" : "\u25b6"}</span>
        <span className="wk-sr-only">
          {unavailable
            ? `No voice available for ${lang}`
            : speaking
              ? "Stop speaking"
              : `Hear this read aloud in ${lang}`}
        </span>
      </button>

      {hint ? (
        <span
          className="wk-caps"
          role="status"
          title={hint}
          style={{ textTransform: "none", letterSpacing: "0.02em", maxWidth: "42ch", lineHeight: 1.4 }}
        >
          {hint}
        </span>
      ) : null}
    </span>
  );
}
