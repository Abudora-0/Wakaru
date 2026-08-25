import { describe, expect, it } from "vitest";
import { matchVoice, piperLanguages, piperVoiceFor, spokenLanguages, voiceAvailability, voiceLikelihood } from "./index";

/**
 * Voice matching, tested against the voice lists real machines actually
 * report. The bug these cover: asking for "en" found nothing, because a
 * Windows voice calls itself en-US and an exact comparison against the bare
 * base language never matches.
 */

function voice(lang: string, name = lang): SpeechSynthesisVoice {
  return { lang, name, default: false, localService: true, voiceURI: name } as SpeechSynthesisVoice;
}

/** What a stock Windows install reports. */
const WINDOWS = [voice("en-US", "Microsoft David"), voice("en-GB", "Microsoft Hazel")];

describe("matchVoice", () => {
  it("finds a regional voice when the bare base language was asked for", () => {
    // This is the case that was failing: no voice calls itself plain "en".
    const match = matchVoice(WINDOWS, "en");
    expect(match).not.toBeNull();
    expect(match?.voice.lang).toBe("en-US");
    expect(match?.exact).toBe(false);
  });

  it("prefers an exact locale over the base language", () => {
    const match = matchVoice(WINDOWS, "en-GB");
    expect(match?.voice.lang).toBe("en-GB");
    expect(match?.exact).toBe(true);
  });

  it("walks a dialect's preferred locales in order", () => {
    const voices = [voice("es-ES"), voice("es-MX"), voice("es-US")];
    const match = matchVoice(voices, "es-MX");

    expect(match?.voice.lang).toBe("es-MX");
    expect(match?.exact).toBe(true);
  });

  it("falls back through a dialect's list before giving up", () => {
    // Mexican Spanish lists es-MX then es-US, and only es-US is installed.
    const match = matchVoice([voice("es-US"), voice("en-US")], "es-MX");

    expect(match?.voice.lang).toBe("es-US");
    expect(match?.exact).toBe(true);
  });

  it("accepts any regional voice for a dialect's base language", () => {
    const match = matchVoice([voice("es-AR"), voice("en-US")], "es-MX");

    expect(match?.voice.lang).toBe("es-AR");
    expect(match?.exact).toBe(false);
  });

  it("tolerates an underscore separator and odd casing", () => {
    const match = matchVoice([voice("en_us", "Legacy")], "en");
    expect(match?.voice.name).toBe("Legacy");
  });

  it("returns null when the language is genuinely absent", () => {
    expect(matchVoice(WINDOWS, "ja")).toBeNull();
  });

  it("returns null for an empty list rather than pretending", () => {
    expect(matchVoice([], "en")).toBeNull();
  });
});

describe("spokenLanguages", () => {
  it("reduces a voice list to the base languages it covers", () => {
    const voices = [voice("en-US"), voice("en-GB"), voice("ja-JP"), voice("es-MX")];
    expect(spokenLanguages(voices)).toEqual(["en", "es", "ja"]);
  });

  it("is empty when the browser reports nothing", () => {
    expect(spokenLanguages([])).toEqual([]);
  });
});

describe("voice coverage", () => {
  it("treats the languages every platform ships as wide", () => {
    for (const code of ["en", "es", "ja", "ar", "hi", "zh"]) {
      expect(voiceLikelihood(code)).toBe("wide");
    }
  });

  it("treats optional platform downloads as common", () => {
    expect(voiceLikelihood("ur")).toBe("common");
    expect(voiceLikelihood("cy")).toBe("common");
  });

  it("treats anything else as rare", () => {
    expect(voiceLikelihood("haw")).toBe("rare");
    expect(voiceLikelihood("eo")).toBe("rare");
  });

  it("resolves a dialect to its base before judging", () => {
    // es-MX has no voice list of its own here, but Spanish certainly does.
    expect(voiceLikelihood("es-MX")).toBe("wide");
    expect(voiceLikelihood("pa-Arab")).toBe("common");
  });
});

describe("voiceAvailability", () => {
  const someVoices = [{ lang: "en-US" }, { lang: "fr-FR" }];

  it("offers straight away when a voice is installed", () => {
    expect(voiceAvailability("en", someVoices, true)).toEqual({ state: "device", offer: true });
  });

  it("still offers a widely shipped language with nothing installed", () => {
    const result = voiceAvailability("ja", someVoices, false);
    expect(result.state).toBe("likely");
    expect(result.offer).toBe(true);
  });

  it("declines a language the platform rarely speaks", () => {
    const result = voiceAvailability("haw", someVoices, false);
    expect(result.state).toBe("unlikely");
    expect(result.offer).toBe(false);
    expect(result.reason).toMatch(/no voice/i);
  });

  it("blames the blocker, not the language, when no voices are reported", () => {
    // Reporting "Hawaiian is unsupported" here would send someone to fix
    // entirely the wrong thing.
    const result = voiceAvailability("haw", [], false);
    expect(result.state).toBe("blocked");
    expect(result.offer).toBe(true);
    expect(result.reason).toMatch(/privacy blocker/i);
  });
});

describe("downloadable voices", () => {
  it("offers a voice for the languages the runtime ships", () => {
    for (const code of ["en", "es", "fr", "de", "zh", "ru", "ar", "pt", "tr", "uk"]) {
      expect(piperVoiceFor(code)).not.toBeNull();
    }
  });

  it("gives a dialect its own voice rather than the base language's", () => {
    // Asking for Mexican Spanish and getting a Castilian voice is exactly the
    // sort of quiet substitution the rest of this project refuses to make.
    expect(piperVoiceFor("es-MX")).toBe("es_MX-ald-medium");
    expect(piperVoiceFor("es-ES")).toBe("es_ES-davefx-medium");
    expect(piperVoiceFor("en-GB")).toBe("en_GB-alan-medium");
    expect(piperVoiceFor("pt-PT")).toBe("pt_PT-tugão-medium");
  });

  it("falls back to the base language for a dialect with no voice of its own", () => {
    expect(piperVoiceFor("es-AR")).toBe(piperVoiceFor("es"));
    expect(piperVoiceFor("ar-EG")).toBe(piperVoiceFor("ar"));
  });

  it("returns null for the languages the runtime does not carry", () => {
    // Japanese and Korean are in Piper upstream but not in the voice mirror
    // this runtime is pinned to, so they stay on device voices. Claiming
    // otherwise would produce a download that 404s.
    expect(piperVoiceFor("ja")).toBeNull();
    expect(piperVoiceFor("ko")).toBeNull();
    expect(piperVoiceFor("hi")).toBeNull();
    expect(piperVoiceFor("ur")).toBeNull();
  });

  it("covers a useful share of the registry", () => {
    expect(piperLanguages().length).toBeGreaterThanOrEqual(30);
  });
});
