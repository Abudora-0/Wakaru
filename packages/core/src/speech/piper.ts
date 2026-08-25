import type { LangCode } from "../types";
import { baseOf } from "../dialects";

/**
 * Neural voices that run in the browser.
 *
 * Piper models are ONNX files fetched once and cached, then run locally on
 * the CPU. Nothing is uploaded, nothing needs a key, and no endpoint can rate
 * limit it or disappear. That makes it the only way this site can promise a
 * voice rather than predict one, since Web Speech depends entirely on what
 * the reader's operating system happens to ship, and a privacy blocker can
 * hide even that.
 *
 * The cost is honest and large: roughly 60 MB per language, once.
 *
 * Coverage is set by the voice mirror the runtime is pinned to, which is
 * smaller than Piper's full upstream collection. Japanese and Korean are not
 * in it, which matters here, so those two stay on device voices. They are
 * widely installed, so in practice most readers still hear them.
 */

/** The best available voice per language, preferring medium quality. */
const VOICES: Record<LangCode, string> = {
  ar: "ar_JO-kareem-medium",
  ca: "ca_ES-upc_ona-medium",
  cs: "cs_CZ-jirka-medium",
  da: "da_DK-talesyntese-medium",
  de: "de_DE-thorsten-medium",
  el: "el_GR-rapunzelina-low",
  en: "en_US-amy-medium",
  es: "es_ES-davefx-medium",
  fa: "fa_IR-amir-medium",
  fi: "fi_FI-harri-medium",
  fr: "fr_FR-siwis-medium",
  hu: "hu_HU-anna-medium",
  is: "is_IS-salka-medium",
  it: "it_IT-riccardo-x_low",
  ka: "ka_GE-natia-medium",
  kk: "kk_KZ-issai-high",
  lb: "lb_LU-marylux-medium",
  ne: "ne_NP-google-medium",
  nl: "nl_NL-mls-medium",
  no: "no_NO-talesyntese-medium",
  pl: "pl_PL-gosia-medium",
  pt: "pt_BR-faber-medium",
  ro: "ro_RO-mihai-medium",
  ru: "ru_RU-irina-medium",
  sk: "sk_SK-lili-medium",
  sl: "sl_SI-artur-medium",
  sr: "sr_RS-serbski_institut-medium",
  sv: "sv_SE-nst-medium",
  sw: "sw_CD-lanfrica-medium",
  tr: "tr_TR-fahrettin-medium",
  uk: "uk_UA-ukrainian_tts-medium",
  vi: "vi_VN-vais1000-medium",
  zh: "zh_CN-huayan-medium",
};

/**
 * Dialects that have a voice of their own rather than borrowing the base
 * language's. Asking for Mexican Spanish and getting a Castilian voice is
 * exactly the sort of thing the rest of this project refuses to do quietly.
 */
const DIALECT_VOICES: Record<LangCode, string> = {
  "en-GB": "en_GB-alan-medium",
  "en-US": "en_US-amy-medium",
  "es-MX": "es_MX-ald-medium",
  "es-ES": "es_ES-davefx-medium",
  "pt-BR": "pt_BR-faber-medium",
  "pt-PT": "pt_PT-tugão-medium",
  "nl-BE": "nl_BE-nathalie-medium",
};

/** The Piper voice for a language or dialect, or null if there is none. */
export function piperVoiceFor(lang: LangCode): string | null {
  return DIALECT_VOICES[lang] ?? VOICES[baseOf(lang)] ?? null;
}

/** Every language a downloadable voice exists for. */
export function piperLanguages(): LangCode[] {
  return Object.keys(VOICES).sort();
}

/** Roughly what a reader is agreeing to download, in megabytes. */
export const PIPER_MODEL_MB = 60;
