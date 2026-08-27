/** Languages the reader can recognise. These are Tesseract model names. */
export type OcrLang = "jpn" | "jpn_vert" | "kor" | "chi_sim" | "chi_tra" | "eng";

/** What a raw page is written in, before vertical orientation is decided. */
export type SourceScript = "japanese" | "korean" | "chinese-simplified" | "chinese-traditional" | "english";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrRegion {
  id: string;
  box: Box;
  text: string;
  /** Tesseract confidence, 0 to 100. */
  confidence: number;
  /** True when the region was read as vertical text. */
  vertical: boolean;
}

export interface OcrPage {
  width: number;
  height: number;
  regions: OcrRegion[];
  /**
   * How many regions the detector found, before recognition.
   *
   * Kept separate from regions.length because the two answer different
   * questions. A page where detection found nothing needs different artwork.
   * A page where detection found plenty but recognition could not read any of
   * it is a model or a preprocessing problem, and telling a reader "no text
   * found" in that case is simply wrong.
   */
  detected: number;
  /** Regions dropped for falling under the confidence floor. */
  rejected: number;
  /** Milliseconds spent, useful because OCR is the slow part of the reader. */
  elapsedMs: number;
}

export type OcrStage = "loading-model" | "detecting-bubbles" | "reading" | "done";

export interface OcrProgress {
  stage: OcrStage;
  /** 0 to 1 within the current stage. */
  value: number;
  /** Set during "reading" so the interface can show which bubble is in hand. */
  region?: number;
  total?: number;
}

export interface RecognizeOptions {
  script: SourceScript;
  /**
   * Find speech bubbles and read each one separately. This is much better on
   * manga than reading the whole page at once, because a page is a collage of
   * unrelated text blocks rather than a document.
   */
  detectBubbles?: boolean;
  /**
   * Drop regions the engine was not confident about.
   *
   * Leave unset to use DEFAULT_MIN_CONFIDENCE, which is tuned per recognition
   * language rather than a single number. Set this only to override that
   * table uniformly across every region on the page.
   */
  minConfidence?: number;
  onProgress?: (progress: OcrProgress) => void;
  signal?: AbortSignal;
}

/**
 * Confidence floor per recognition language, used when minConfidence is not
 * given explicitly.
 *
 * Tesseract is systematically more pessimistic on vertical Japanese than on
 * anything else it reads, an artefact of a model trained mostly on horizontal
 * Latin documents: text it recognises correctly still often scores in the
 * thirties. A single floor tuned to be safe for that case would let real
 * garbage through everywhere else, so each engine gets its own number rather
 * than sharing one that fits nothing well.
 */
export const DEFAULT_MIN_CONFIDENCE: Record<OcrLang, number> = {
  eng: 40,
  jpn: 35,
  jpn_vert: 25,
  kor: 40,
  chi_sim: 35,
  chi_tra: 35,
};

/** Model files for each script, with the vertical variant where one exists. */
export const SCRIPT_MODELS: Record<SourceScript, { horizontal: OcrLang; vertical?: OcrLang }> = {
  japanese: { horizontal: "jpn", vertical: "jpn_vert" },
  korean: { horizontal: "kor" },
  "chinese-simplified": { horizontal: "chi_sim" },
  "chinese-traditional": { horizontal: "chi_tra" },
  english: { horizontal: "eng" },
};

export const SCRIPT_LABELS: Record<SourceScript, string> = {
  japanese: "Japanese",
  korean: "Korean",
  "chinese-simplified": "Chinese, simplified",
  "chinese-traditional": "Chinese, traditional",
  english: "English",
};

/** Which language tag to hand the translator for each source script. */
export const SCRIPT_TO_LANG: Record<SourceScript, string> = {
  japanese: "ja",
  korean: "ko",
  "chinese-simplified": "zh",
  "chinese-traditional": "zh",
  english: "en",
};
