import type { LangCode } from "../types";
import { baseOf } from "../dialects";

/**
 * Which languages a browser is likely to be able to speak.
 *
 * Web Speech reads from voices the operating system provides, so coverage is
 * a property of the reader's machine, not of this site. That cannot be
 * detected until the page is open, but it can be predicted well: the voice
 * sets shipped by Windows, macOS, Android and iOS overlap heavily, and the
 * languages in that overlap are the ones worth offering.
 *
 * The point of this table is to say "not available" before someone presses a
 * button and hears nothing, rather than after.
 */

export type VoiceLikelihood =
  /** Present on essentially every platform, out of the box. */
  | "wide"
  /** Shipped by most platforms, though sometimes as an optional download. */
  | "common"
  /** Rarely present. Offered, but flagged as unlikely. */
  | "rare";

/**
 * Compiled from the default voice sets of the major platforms. Deliberately
 * conservative: a language is only "wide" if every mainstream platform ships
 * it without an extra download.
 */
const WIDE: LangCode[] = [
  "en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh",
  "ar", "hi", "nl", "pl", "tr", "sv", "da", "no", "fi", "cs",
  "el", "he", "th", "id", "ro", "hu", "sk", "vi",
];

const COMMON: LangCode[] = [
  "uk", "ms", "ca", "hr", "bg", "sr", "sl", "lt", "lv", "et",
  "fa", "ta", "te", "bn", "ur", "ml", "kn", "gu", "mr", "pa",
  "sw", "af", "sq", "mk", "is", "cy", "eu", "gl", "hy", "az",
  "ka", "km", "lo", "my", "si", "ne", "bs",
];

const LIKELIHOOD = new Map<LangCode, VoiceLikelihood>([
  ...WIDE.map((code) => [code, "wide"] as const),
  ...COMMON.map((code) => [code, "common"] as const),
]);

/** How likely this reader's machine is to have a voice for a language. */
export function voiceLikelihood(lang: LangCode): VoiceLikelihood {
  return LIKELIHOOD.get(baseOf(lang)) ?? "rare";
}

/** Every language this project claims a browser will usually speak. */
export function spokenByMostPlatforms(): LangCode[] {
  return [...WIDE];
}

export interface VoiceAvailability {
  /**
   * "device"   a voice for this language is installed right now
   * "likely"   none installed, but the platform usually ships one
   * "unlikely" none installed, and the platform rarely ships one
   * "blocked"  the browser reports no voices at all, so nothing can be said
   */
  state: "device" | "likely" | "unlikely" | "blocked";
  /** Whether it is worth letting the reader press the button. */
  offer: boolean;
  /** A short sentence for the interface, already phrased for the reader. */
  reason?: string;
}

/**
 * Decide what to tell the reader, given the voices this browser reports.
 *
 * The blocked case is kept apart from the others on purpose. A browser that
 * reports zero voices is almost always hiding them for fingerprinting reasons
 * rather than having none, and telling someone their language is unsupported
 * in that situation sends them to fix the wrong thing.
 */
export function voiceAvailability(
  lang: LangCode,
  voices: { lang: string }[],
  hasDeviceVoice: boolean,
): VoiceAvailability {
  if (hasDeviceVoice) return { state: "device", offer: true };

  if (voices.length === 0) {
    return {
      state: "blocked",
      offer: true,
      reason: "this browser is not reporting any voices, which is usually a privacy blocker rather than none installed",
    };
  }

  if (voiceLikelihood(lang) === "rare") {
    return {
      state: "unlikely",
      offer: false,
      reason: "no voice for this language is available on this device",
    };
  }

  return {
    state: "likely",
    offer: true,
    reason: "no exact voice is installed, so the browser will approximate",
  };
}
