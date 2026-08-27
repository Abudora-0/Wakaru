import { PSM, createWorker, type Worker } from "tesseract.js";
import { detectBubbles, looksVertical } from "./bubbles";
import { stripFurigana } from "./furigana";
import { createCanvas, prepareRegion } from "./preprocess";
import {
  DEFAULT_MIN_CONFIDENCE,
  SCRIPT_MODELS,
  type Box,
  type OcrLang,
  type OcrPage,
  type OcrRegion,
  type RecognizeOptions,
} from "./types";

/**
 * The recogniser.
 *
 * Everything runs in the browser: the WebAssembly build of Tesseract, the
 * language models and the image work. There is no OCR service, no key and no
 * upload, which also means a page never leaves the reader's machine.
 *
 * Models are large, between two and sixteen megabytes each, so workers are
 * kept alive between pages and the model is fetched once and cached by the
 * browser.
 */

const workers = new Map<OcrLang, Promise<Worker>>();

function getWorker(lang: OcrLang, onProgress?: (value: number) => void): Promise<Worker> {
  const existing = workers.get(lang);
  if (existing) return existing;

  const created = createWorker(lang, 1, {
    logger: (message: { status: string; progress: number }) => {
      if (message.status.includes("loading") || message.status.includes("initializ")) {
        onProgress?.(message.progress);
      }
    },
  });

  workers.set(lang, created);
  return created;
}

/** Release the workers and their models. Worth calling when leaving the reader. */
export async function disposeOcr(): Promise<void> {
  const pending = [...workers.values()];
  workers.clear();
  await Promise.all(pending.map(async (promise) => (await promise).terminate()));
}

async function readBox(
  source: CanvasImageSource,
  box: Box,
  lang: OcrLang,
  vertical: boolean,
  onModelProgress?: (value: number) => void,
): Promise<{ text: string; confidence: number }> {
  const worker = await getWorker(lang, onModelProgress);

  await worker.setParameters({
    // A bubble holds one block of text. Telling Tesseract that, rather than
    // letting it hunt for a page layout, is a large accuracy win.
    tessedit_pageseg_mode: vertical ? PSM.SINGLE_BLOCK_VERT_TEXT : PSM.SINGLE_BLOCK,
    preserve_interword_spaces: "1",
  });

  const prepared = prepareRegion(source, box, { scale: 2, binarise: true });

  /*
   * Furigana is the small reading gloss beside a kanji column, and it is the
   * single biggest source of garbage in Japanese output: Tesseract has no
   * idea it is looking at two different things and reads the gloss as more
   * body text, interleaved into whatever comes out. It is a vertical layout
   * phenomenon, so it is only attempted for vertical Japanese.
   */
  if (vertical && lang === "jpn_vert") {
    stripFuriganaFromCanvas(prepared.canvas);
  }

  // The published ImageLike union predates OffscreenCanvas, which the worker
  // accepts at runtime, so the surface is narrowed to a canvas for the call.
  const result = await worker.recognize(prepared.canvas as HTMLCanvasElement);

  return {
    text: cleanText(result.data.text),
    confidence: result.data.confidence,
  };
}

/**
 * Blank the furigana columns of a prepared, binarised region canvas in place.
 *
 * The canvas convention from prepareRegion is dark ink at 0 and light
 * background at 255. stripFurigana works on a plain 1-is-ink mask, so the
 * conversion happens on the way in and the paint happens on the way out.
 */
function stripFuriganaFromCanvas(canvas: OffscreenCanvas | HTMLCanvasElement): void {
  const context = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!context) return;

  const { width, height } = canvas;
  if (width === 0 || height === 0) return;

  const image = context.getImageData(0, 0, width, height);

  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
    mask[p] = (image.data[i] ?? 0) < 128 ? 1 : 0;
  }

  const { removed, mask: cleaned } = stripFurigana(mask, width, height);
  if (removed.length === 0) return;

  for (let p = 0; p < cleaned.length; p++) {
    if (mask[p] === 1 && cleaned[p] === 0) {
      const i = p * 4;
      image.data[i] = 255;
      image.data[i + 1] = 255;
      image.data[i + 2] = 255;
    }
  }

  context.putImageData(image, 0, 0);
}

/**
 * Tesseract inserts spaces between every character in CJK output and leaves
 * line breaks from the column layout, neither of which belong in the text that
 * goes to the translator.
 */
export function cleanText(raw: string): string {
  let text = raw.replace(/\r/g, "").trim();

  // Collapse the spaces Tesseract puts between CJK characters.
  text = text.replace(/([぀-ヿ㐀-鿿豈-﫿가-힯])\s+(?=[぀-ヿ㐀-鿿豈-﫿가-힯])/g, "$1");

  // A vertical column arrives as one character per line.
  text = text.replace(/\n{2,}/g, "\n").replace(/\n/g, " ");
  text = text.replace(/\s{2,}/g, " ");

  return text.trim();
}

/** Draw the source once so every later step reads from the same surface. */
function toCanvas(source: CanvasImageSource, width: number, height: number) {
  const prepared = createCanvas(width, height);
  prepared.context.drawImage(source, 0, 0, width, height);
  return prepared.canvas;
}

export async function recognizePage(
  source: CanvasImageSource,
  width: number,
  height: number,
  options: RecognizeOptions,
): Promise<OcrPage> {
  const started = Date.now();
  const models = SCRIPT_MODELS[options.script];

  const page = toCanvas(source, width, height);

  options.onProgress?.({ stage: "detecting-bubbles", value: 0 });

  let boxes: Box[] = options.detectBubbles === false
    ? []
    : detectBubbles(page as CanvasImageSource, width, height);

  // Webtoons and manhwa often set text straight onto the artwork with no
  // bubble at all, so falling back to the whole page is the correct answer
  // rather than reporting that there is nothing to read.
  const wholePage = boxes.length === 0;
  if (wholePage) {
    boxes = [{ x: 0, y: 0, width, height }];
  }

  options.onProgress?.({ stage: "detecting-bubbles", value: 1 });

  const regions: OcrRegion[] = [];
  let rejected = 0;

  for (let index = 0; index < boxes.length; index++) {
    if (options.signal?.aborted) break;

    const box = boxes[index] as Box;
    const vertical = !wholePage && Boolean(models.vertical) && looksVertical(box);
    const lang = vertical && models.vertical ? models.vertical : models.horizontal;
    const minConfidence = options.minConfidence ?? DEFAULT_MIN_CONFIDENCE[lang];

    options.onProgress?.({
      stage: "reading",
      value: index / boxes.length,
      region: index + 1,
      total: boxes.length,
    });

    try {
      const { text, confidence } = await readBox(page as CanvasImageSource, box, lang, vertical, (value) =>
        options.onProgress?.({ stage: "loading-model", value }),
      );

      if (!text || confidence < minConfidence) {
        rejected++;
        continue;
      }

      regions.push({
        id: `r${index}`,
        box,
        text,
        confidence,
        vertical,
      });
    } catch {
      // One unreadable bubble should not lose the rest of the page.
      rejected++;
      continue;
    }
  }

  options.onProgress?.({ stage: "done", value: 1 });

  return {
    width,
    height,
    detected: boxes.length,
    rejected,
    // detectBubbles already returned reading order, and regions were pushed
    // in that order, so no second sort is needed here.
    regions,
    elapsedMs: Date.now() - started,
  };
}
