import type { LangCode } from "../types";
import { ttsLocalesFor } from "../dialects";

/**
 * Voice pronunciation through the browser's own speech synthesiser.
 *
 * This is the only text to speech that is free for every language with no
 * key, no quota and no network call. The catch is that the voices belong to
 * the operating system and the browser decides how much of that list to hand
 * over, so this module has to be careful about three different situations
 * that all look identical from the outside:
 *
 *   the browser has no speech synthesis at all
 *   the browser has it but reports zero voices, which usually means a privacy
 *     blocker is hiding the list rather than that none are installed
 *   the browser has voices but none for the language being asked for
 *
 * Telling a reader "no voice for en is installed" when the real cause is the
 * second case sends them looking for a Windows setting that is already set.
 */

export interface VoiceMatch {
  voice: SpeechSynthesisVoice;
  /** True when the voice matches the requested locale exactly. */
  exact: boolean;
  /** The locale that actually matched, which may be the base language. */
  matched: string;
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Collect the voice list.
 *
 * Chromium populates this lazily and fires voiceschanged once, sometimes
 * before a listener can be attached, so waiting on the event alone loses the
 * race and reports an empty list. Polling alongside the event is what makes
 * this reliable, and the window is generous because a cold speech engine on
 * Windows can take a couple of seconds to enumerate.
 */
export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);

  const immediate = window.speechSynthesis.getVoices();
  if (immediate.length > 0) return Promise.resolve(immediate);

  return new Promise((resolve) => {
    let settled = false;
    const deadline = Date.now() + timeoutMs;

    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onChange);
      clearInterval(timer);
      resolve(voices);
    };

    const check = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) finish(voices);
      else if (Date.now() >= deadline) finish([]);
    };

    const onChange = () => check();
    const timer = setInterval(check, 150);

    window.speechSynthesis.addEventListener("voiceschanged", onChange);
  });
}

/** Normalise en_US and en-us to en-us so comparisons are predictable. */
function normalise(tag: string): string {
  return tag.replace("_", "-").toLowerCase();
}

/**
 * Walk the dialect's preferred locales most specific first, then fall back to
 * any voice for the base language.
 */
export function matchVoice(voices: SpeechSynthesisVoice[], lang: LangCode): VoiceMatch | null {
  if (voices.length === 0) return null;

  const wanted = ttsLocalesFor(lang).map(normalise);

  for (const target of wanted) {
    const exact = voices.find((voice) => normalise(voice.lang) === target);
    if (exact) return { voice: exact, exact: true, matched: target };
  }

  // Nothing exact, so accept any voice whose base language matches.
  for (const target of wanted) {
    const base = target.split("-")[0];
    if (!base) continue;
    const loose = voices.find((voice) => normalise(voice.lang).split("-")[0] === base);
    if (loose) return { voice: loose, exact: false, matched: loose.lang };
  }

  return null;
}

/** Which base languages this browser can actually speak, for diagnostics. */
export function spokenLanguages(voices: SpeechSynthesisVoice[]): string[] {
  const bases = voices
    .map((voice) => normalise(voice.lang).split("-")[0])
    .filter((base): base is string => Boolean(base));
  return [...new Set(bases)].sort();
}

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

export interface SpeakOutcome {
  spoken: boolean;
  /** Set when a voice was found but not for the exact dialect requested. */
  approximate?: string;
  /** Set when nothing could be spoken, phrased for the actual cause. */
  unavailable?: string;
}

export async function speak(text: string, lang: LangCode, options: SpeakOptions = {}): Promise<SpeakOutcome> {
  if (!speechSupported()) {
    return { spoken: false, unavailable: "this browser has no speech synthesis" };
  }
  if (!text.trim()) {
    return { spoken: false, unavailable: "there is nothing to read" };
  }

  const voices = await loadVoices();
  const match = matchVoice(voices, lang);

  /*
   * A browser that reports no voices at all is a different problem from one
   * that has voices but not this language. The usual cause is a privacy
   * blocker hiding the list, Brave's fingerprinting protection in particular,
   * and no amount of installing Windows voices will change it.
   */
  if (voices.length === 0) {
    return {
      spoken: false,
      unavailable:
        "this browser is not reporting any voices, which is usually a privacy or fingerprinting blocker hiding them rather than none being installed",
    };
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = match ? match.voice.lang : lang;
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;

  /*
   * Only pin a voice when one actually matched. Left unset, the engine picks
   * for itself from the lang tag, and frequently gets it right for a language
   * that has no separately enumerated voice. Refusing to speak here was the
   * old behaviour and it made the feature look broken on machines that could
   * have spoken perfectly well.
   */
  if (match) utterance.voice = match.voice;

  if (options.onEnd) utterance.addEventListener("end", options.onEnd);
  if (options.onError) {
    utterance.addEventListener("error", (event) => options.onError?.(event.error ?? "speech failed"));
  }

  window.speechSynthesis.speak(utterance);

  if (match?.exact) return { spoken: true };

  if (match) {
    return {
      spoken: true,
      approximate: `using a ${match.matched} voice, no exact ${lang} voice is installed`,
    };
  }

  const available = spokenLanguages(voices);
  return {
    spoken: true,
    approximate: `no ${lang} voice is installed, so the browser is choosing. It has voices for ${available.slice(0, 6).join(", ")}${available.length > 6 ? " and others" : ""}`,
  };
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
