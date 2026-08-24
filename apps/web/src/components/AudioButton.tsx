"use client";

import { useRef, useState } from "react";

/**
 * Plays a real human recording, as opposed to the synthesised voice behind
 * SpeakButton. Where a recording exists it is always the better answer, so the
 * entry page offers it first and falls back to synthesis underneath.
 */
export function AudioButton({ src, accent }: { src: string; accent?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <span className="ipa">
      <button
        type="button"
        className="wk-seal-btn wk-seal-btn--sm"
        onClick={() => {
          const audio = ref.current;
          if (!audio) return;
          if (playing) {
            audio.pause();
            audio.currentTime = 0;
            setPlaying(false);
          } else {
            void audio.play().catch(() => setFailed(true));
          }
        }}
        aria-pressed={playing}
      >
        <span aria-hidden="true">{playing ? "■" : "▶"}</span>
        <span className="wk-sr-only">
          {accent ? `Play the ${accent} recording` : "Play the recording"}
        </span>
      </button>
      {accent ? <span className="ipa__accent">{accent}</span> : null}
      <audio
        ref={ref}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
