/**
 * Script transliteration.
 *
 * Two very different cases live here and the difference matters:
 *
 *   Serbian is digraphic by design. The Cyrillic and Latin alphabets map one
 *   to one, so the conversion is exact and reversible. It is marked lossless.
 *
 *   Punjabi, Urdu and Hindi romanisation are approximations. Shahmukhi does
 *   not write short vowels, and Devanagari and the Perso-Arabic script do not
 *   share a phoneme inventory. These are marked lossy, and the interface says
 *   so rather than presenting a guess as a fact.
 */

import { devanagariToLatin } from "./indic.js";

export interface TranslitRuleSet {
  id: string;
  label: string;
  from: string;
  to: string;
  /** False when information is discarded and the result cannot round trip. */
  lossless: boolean;
  /** Why the mapping is imperfect, surfaced in the interface. */
  caveat?: string;
  /** Map driven rule sets are a straight character substitution. Indic
   *  scripts need syllabic logic instead, because the inherent vowel is not
   *  written and cannot be recovered from a table. */
  kind?: "map" | "syllabic";
  map: Record<string, string>;
}

/* Serbian is fully digraphic. Digraphs are listed before single letters so the
 * longest match wins. */
const SERBIAN_CYRL_TO_LATN: Record<string, string> = {
  "Љ": "Lj", "љ": "lj", "Њ": "Nj", "њ": "nj", "Џ": "Dž", "џ": "dž",
  "А": "A", "а": "a", "Б": "B", "б": "b", "В": "V", "в": "v",
  "Г": "G", "г": "g", "Д": "D", "д": "d", "Ђ": "Đ", "ђ": "đ",
  "Е": "E", "е": "e", "Ж": "Ž", "ж": "ž", "З": "Z", "з": "z",
  "И": "I", "и": "i", "Ј": "J", "ј": "j", "К": "K", "к": "k",
  "Л": "L", "л": "l", "М": "M", "м": "m", "Н": "N", "н": "n",
  "О": "O", "о": "o", "П": "P", "п": "p", "Р": "R", "р": "r",
  "С": "S", "с": "s", "Т": "T", "т": "t", "Ћ": "Ć", "ћ": "ć",
  "У": "U", "у": "u", "Ф": "F", "ф": "f", "Х": "H", "х": "h",
  "Ц": "C", "ц": "c", "Ч": "Č", "ч": "č", "Ш": "Š", "ш": "š",
};

/* Gurmukhi to Shahmukhi. Aspirates are two characters in Shahmukhi, so those
 * conjuncts are listed first. */
const GURMUKHI_TO_SHAHMUKHI: Record<string, string> = {
  "ਖ਼": "خ", "ਗ਼": "غ", "ਜ਼": "ز", "ਫ਼": "ف", "ਸ਼": "ش", "ਲ਼": "ل",
  "ਖ": "کھ", "ਘ": "گھ", "ਛ": "چھ", "ਝ": "جھ",
  "ਠ": "ٹھ", "ਢ": "ڈھ", "ਥ": "تھ", "ਧ": "دھ", "ਫ": "پھ", "ਭ": "بھ",
  "ਅ": "ا", "ਆ": "آ", "ਇ": "ا", "ਈ": "ای", "ਉ": "ا", "ਊ": "او",
  "ਏ": "اے", "ਐ": "اے", "ਓ": "او", "ਔ": "او",
  "ਕ": "ک", "ਗ": "گ", "ਙ": "ن",
  "ਚ": "چ", "ਜ": "ج", "ਞ": "ن",
  "ਟ": "ٹ", "ਡ": "ڈ", "ਣ": "ݨ",
  "ਤ": "ت", "ਦ": "د", "ਨ": "ن",
  "ਪ": "پ", "ਬ": "ب", "ਮ": "م",
  "ਯ": "ی", "ਰ": "ر", "ਲ": "ل", "ਵ": "و", "ੜ": "ڑ",
  "ਸ": "س", "ਹ": "ہ",
  "ਾ": "ا", "ੀ": "ی", "ੂ": "و", "ੇ": "ے", "ੈ": "ے", "ੋ": "و", "ੌ": "و",
  "ਿ": "", "ੁ": "", "ੱ": "", "੍": "",
  "ੰ": "ں", "ਂ": "ں",
  "।": "۔", "॥": "۔",
};

/* Devanagari to Latin, in the plain style used in everyday Hinglish rather
 * than in scholarly IAST, because that is what people actually type. */
const DEVANAGARI_TO_LATIN: Record<string, string> = {
  "क्ष": "ksh", "त्र": "tr", "ज्ञ": "gy", "श्र": "shr",
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
  "ा": "a", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
  "ं": "n", "ँ": "n", "ः": "h", "्": "",
  "।": ".", "॥": ".",
};

export const RULE_SETS: readonly TranslitRuleSet[] = [
  {
    id: "serbian-cyrl-to-latn",
    label: "Serbian Cyrillic to Latin",
    from: "Cyrl",
    to: "Latn",
    lossless: true,
    map: SERBIAN_CYRL_TO_LATN,
  },
  {
    id: "gurmukhi-to-shahmukhi",
    label: "Punjabi Gurmukhi to Shahmukhi",
    from: "Guru",
    to: "Arab",
    lossless: false,
    caveat:
      "Shahmukhi does not write short vowels, so the result is readable but not a perfect record of the original spelling.",
    map: GURMUKHI_TO_SHAHMUKHI,
  },
  {
    id: "devanagari-to-latin",
    kind: "syllabic",
    label: "Devanagari to Latin",
    from: "Deva",
    to: "Latn",
    lossless: false,
    caveat:
      "Romanised Hindi has no single accepted spelling. This follows common everyday usage rather than scholarly IAST.",
    map: DEVANAGARI_TO_LATIN,
  },
  {
    id: "urdu-to-devanagari",
    label: "Urdu to Devanagari",
    from: "Arab",
    to: "Deva",
    lossless: false,
    caveat:
      "The Perso-Arabic script omits short vowels, so vowels must be inferred and some words will be spelled incorrectly.",
    map: {
      "آ": "आ", "ا": "अ", "ب": "ब", "پ": "प", "ت": "त", "ٹ": "ट", "ث": "स",
      "ج": "ज", "چ": "च", "ح": "ह", "خ": "ख", "د": "द", "ڈ": "ड", "ذ": "ज़",
      "ر": "र", "ڑ": "ड़", "ز": "ज़", "ژ": "ज़", "س": "स", "ش": "श",
      "ص": "स", "ض": "ज़", "ط": "त", "ظ": "ज़", "ع": "अ", "غ": "ग़",
      "ف": "फ", "ق": "क", "ک": "क", "گ": "ग", "ل": "ल", "م": "म",
      "ن": "न", "ں": "ं", "و": "व", "ہ": "ह", "ھ": "ह", "ء": "", "ی": "य", "ے": "े",
      "۔": "।", "،": ",",
    },
  },
];

const BY_ID = new Map(RULE_SETS.map((r) => [r.id, r]));

export function getRuleSet(id: string): TranslitRuleSet | undefined {
  return BY_ID.get(id);
}

/**
 * Apply a rule set, always matching the longest key first so that digraphs and
 * aspirated consonants are not split into their parts.
 */
export function transliterate(text: string, ruleSetId: string): string {
  const rules = BY_ID.get(ruleSetId);
  if (!rules) return text;

  if (rules.kind === "syllabic") {
    return devanagariToLatin(text);
  }

  const keys = Object.keys(rules.map).sort((a, b) => b.length - a.length);
  const maxKeyLength = keys[0]?.length ?? 1;

  let out = "";
  let i = 0;

  outer: while (i < text.length) {
    for (let len = Math.min(maxKeyLength, text.length - i); len > 0; len--) {
      const slice = text.slice(i, i + len);
      const mapped = rules.map[slice];
      if (mapped !== undefined) {
        out += mapped;
        i += len;
        continue outer;
      }
    }
    out += text[i];
    i += 1;
  }

  return out;
}
