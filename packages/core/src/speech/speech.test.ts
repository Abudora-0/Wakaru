import { describe, expect, it } from "vitest";
import { matchVoice, spokenLanguages } from "./index";

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
