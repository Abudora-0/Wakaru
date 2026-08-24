/**
 * Image preparation.
 *
 * Tesseract was built for scanned documents, not for screentoned artwork with
 * text sitting inside drawn shapes. Feeding it a raw manga page produces
 * mostly noise, so every region is flattened to clean black on white first.
 * This step is the difference between unusable output and readable output.
 */

/** Convert to greyscale in place using the standard luma weights. */
export function toGreyscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
    data[i] = luma;
    data[i + 1] = luma;
    data[i + 2] = luma;
  }
}

/**
 * Otsu's method: pick the threshold that best separates the histogram into two
 * classes. Manga pages vary wildly in exposure, so a fixed threshold at 128
 * would blow out light pages and fill in dark ones.
 */
export function otsuThreshold(data: Uint8ClampedArray): number {
  const histogram = new Array<number>(256).fill(0);
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] ?? 0;
    histogram[value] = (histogram[value] ?? 0) + 1;
    count++;
  }

  let sum = 0;
  for (let level = 0; level < 256; level++) sum += level * (histogram[level] ?? 0);

  let sumBackground = 0;
  let weightBackground = 0;
  let bestVariance = -1;

  // With a cleanly bimodal page every level between the two peaks scores the
  // same, so the first and last winners are tracked and averaged. Taking the
  // first one instead would sit the threshold right on the ink peak and clip
  // faint strokes off the text.
  let firstBest = 0;
  let lastBest = 0;

  for (let level = 0; level < 256; level++) {
    weightBackground += histogram[level] ?? 0;
    if (weightBackground === 0) continue;

    const weightForeground = count - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += level * (histogram[level] ?? 0);

    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;

    if (variance > bestVariance) {
      bestVariance = variance;
      firstBest = level;
      lastBest = level;
    } else if (variance === bestVariance) {
      lastBest = level;
    }
  }

  return Math.round((firstBest + lastBest) / 2);
}

/** Push everything to pure black or pure white at the given threshold. */
export function binarize(data: Uint8ClampedArray, threshold: number): void {
  for (let i = 0; i < data.length; i += 4) {
    const value = (data[i] ?? 0) > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
    data[i + 3] = 255;
  }
}

/**
 * Stretch contrast so faint screentone grey does not survive binarisation as
 * speckle. Percentile clipping avoids a single black panel border dragging the
 * whole range.
 */
export function stretchContrast(data: Uint8ClampedArray, clip = 0.02): void {
  const histogram = new Array<number>(256).fill(0);
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    histogram[data[i] ?? 0] = (histogram[data[i] ?? 0] ?? 0) + 1;
    count++;
  }

  const cut = Math.floor(count * clip);
  let low = 0;
  let high = 255;
  let running = 0;

  for (let level = 0; level < 256; level++) {
    running += histogram[level] ?? 0;
    if (running > cut) {
      low = level;
      break;
    }
  }

  running = 0;
  for (let level = 255; level >= 0; level--) {
    running += histogram[level] ?? 0;
    if (running > cut) {
      high = level;
      break;
    }
  }

  if (high <= low) return;
  const scale = 255 / (high - low);

  for (let i = 0; i < data.length; i += 4) {
    const value = Math.max(0, Math.min(255, ((data[i] ?? 0) - low) * scale));
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
}

export interface PreparedCanvas {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
}

/** OffscreenCanvas where available, so this also runs inside a worker. */
export function createCanvas(width: number, height: number): PreparedCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("could not get a 2d context");
    return { canvas, context: context as OffscreenCanvasRenderingContext2D };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("could not get a 2d context");
  return { canvas, context };
}

export interface PrepareOptions {
  /** Small text needs upscaling before Tesseract can resolve the strokes. */
  scale?: number;
  binarise?: boolean;
}

/**
 * Draw a source region onto a clean canvas, greyscale it, stretch it and
 * binarise it, ready to hand to the recogniser.
 */
export function prepareRegion(
  source: CanvasImageSource,
  box: { x: number; y: number; width: number; height: number },
  options: PrepareOptions = {},
): PreparedCanvas {
  const scale = options.scale ?? 2;
  const width = Math.max(1, Math.round(box.width * scale));
  const height = Math.max(1, Math.round(box.height * scale));

  const prepared = createCanvas(width, height);
  const { context } = prepared;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, box.x, box.y, box.width, box.height, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  toGreyscale(image.data);
  stretchContrast(image.data);

  if (options.binarise !== false) {
    binarize(image.data, otsuThreshold(image.data));
  }

  context.putImageData(image, 0, 0);
  return prepared;
}
