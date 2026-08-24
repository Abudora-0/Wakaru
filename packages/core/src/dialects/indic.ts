/**
 * Devanagari romanisation.
 *
 * A plain character map cannot romanise an Indic script. Every consonant
 * carries an inherent "a" that is not written, so a lookup table turns नमस्ते
 * into "nmste" rather than "namaste". The vowel has to be inserted by rule:
 *
 *   consonant + vowel sign  -> consonant plus that vowel
 *   consonant + virama      -> bare consonant, the cluster continues
 *   consonant + anything    -> consonant plus the inherent "a"
 *
 * Hindi then deletes the inherent vowel at the end of a word, which is why
 * कमल is "kamal" and not "kamala". That final rule is what makes romanised
 * Hindi look like the way people actually type it.
 */

const CONSONANTS: Record<string, string> = {
  "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n",
  "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
  "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n",
  "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
  "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m",
  "य": "y", "र": "r", "ल": "l", "व": "v", "ळ": "l",
  "श": "sh", "ष": "sh", "स": "s", "ह": "h",
  "क़": "q", "ख़": "kh", "ग़": "gh", "ज़": "z", "ड़": "r", "ढ़": "rh", "फ़": "f",
};

/** Dependent vowel signs, which replace the inherent vowel. */
const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo",
  "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
};

/** Independent vowels, which stand alone at the start of a syllable. */
const VOWELS: Record<string, string> = {
  "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo",
  "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au",
};

const MARKS: Record<string, string> = {
  "ं": "n", "ँ": "n", "ः": "h",
};

const VIRAMA = "्";
const INHERENT = "a";

const PUNCTUATION: Record<string, string> = { "।": ".", "॥": "." };

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return (
    ch in CONSONANTS || ch in MATRAS || ch in VOWELS || ch in MARKS || ch === VIRAMA
  );
}

export function devanagariToLatin(input: string): string {
  let out = "";
  let i = 0;

  while (i < input.length) {
    // Nukta forms are two code points, so try the pair before the single.
    const pair = input.slice(i, i + 2);
    const single = input[i] ?? "";

    const consonant = CONSONANTS[pair] ?? CONSONANTS[single];
    if (consonant) {
      const consumed = CONSONANTS[pair] ? 2 : 1;
      out += consonant;
      i += consumed;

      const next = input[i];

      if (next === VIRAMA) {
        // Bare consonant, the cluster carries on into the next letter.
        i += 1;
        continue;
      }

      if (next && MATRAS[next]) {
        out += MATRAS[next];
        i += 1;
        continue;
      }

      // Nothing follows to replace it, so the inherent vowel surfaces, unless
      // this is the last letter of the word and Hindi would drop it.
      const atWordEnd = !isWordChar(input[i]);
      if (!atWordEnd) out += INHERENT;
      continue;
    }

    if (VOWELS[single]) {
      out += VOWELS[single];
      i += 1;
      continue;
    }

    if (MARKS[single]) {
      out += MARKS[single];
      i += 1;
      continue;
    }

    if (PUNCTUATION[single]) {
      out += PUNCTUATION[single];
      i += 1;
      continue;
    }

    // Anything else, including spaces, digits and Latin text, passes through.
    out += single;
    i += 1;
  }

  return out;
}
