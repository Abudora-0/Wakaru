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
  /** Drop regions the engine was not confident about. */
  minConfidence?: number;
  onProgress?: (progress: OcrProgress) => void;
  signal?: AbortSignal;
}

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
