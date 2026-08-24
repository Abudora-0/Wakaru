import type { LangCode } from "../types";
import { ttsLocalesFor } from "../dialects/index";

/**
 * Voice pronunciation through the browser's own speech synthesiser.
 *
 * This is the only text to speech that is free for every language with no key,
 * no quota and no network call, but it is honest about its limits: the voices
 * belong to the operating system, so a dialect that the user has no voice
 * installed for cannot be spoken. The interface says so rather than silently
 * reading Mexican Spanish in a Castilian accent.
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
 * Voices load asynchronously in most browsers and the first call usually
 * returns an empty list, so this waits for the voiceschanged event once.
 */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);

  const existing = window.speechSynthesis.getVoices();
  if (existing.length > 0) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.speechSynthesis.removeEventListener("voiceschanged", finish);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", finish);
    setTimeout(finish, timeoutMs);
  });
}

/** Normalise en_US and en-us to en-US so comparisons are predictable. */
function normalise(tag: string): string {
  return tag.replace("_", "-").toLowerCase();
}

/**
 * Walk the dialect's preferred locales most specific first, then fall back to
 * the base language. Returns null when the machine has nothing that can read
 * the text, which is a real outcome and not an error.
 */
export function matchVoice(voices: SpeechSynthesisVoice[], lang: LangCode): VoiceMatch | null {
  const wanted = ttsLocalesFor(lang).map(normalise);

  for (const target of wanted) {
    const exact = voices.find((voice) => normalise(voice.lang) === target);
    if (exact) return { voice: exact, exact: true, matched: target };
  }

  // Nothing exact, so accept any voice for the base language.
  const base = normalise(wanted[wanted.length - 1] ?? lang).split("-")[0];
  if (base) {
    const loose = voices.find((voice) => normalise(voice.lang).split("-")[0] === base);
    if (loose) return { voice: loose, exact: false, matched: loose.lang };
  }

  return null;
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
  /** Set when nothing on this machine can read the language. */
  unavailable?: string;
}

export async function speak(text: string, lang: LangCode, options: SpeakOptions = {}): Promise<SpeakOutcome> {
  if (!speechSupported()) {
    return { spoken: false, unavailable: "this browser has no speech synthesis" };
  }

  const voices = await loadVoices();
  const match = matchVoice(voices, lang);

  if (!match) {
    return {
      spoken: false,
      unavailable: `no voice for ${lang} is installed on this device`,
    };
  }

  // Cancel anything still speaking, otherwise utterances queue up.
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = match.voice;
  utterance.lang = match.voice.lang;
  utterance.rate = options.rate ?? 0.95;
  utterance.pitch = options.pitch ?? 1;
  utterance.volume = options.volume ?? 1;

  if (options.onEnd) utterance.addEventListener("end", options.onEnd);
  if (options.onError) {
    utterance.addEventListener("error", (event) => options.onError?.(event.error ?? "speech failed"));
  }

  window.speechSynthesis.speak(utterance);

  return match.exact
    ? { spoken: true }
    : { spoken: true, approximate: `using a ${match.matched} voice, no exact ${lang} voice is installed` };
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
