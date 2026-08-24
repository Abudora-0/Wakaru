import type { Box } from "./types";
import { binarize, createCanvas, otsuThreshold, stretchContrast, toGreyscale } from "./preprocess";
import { fillTextHoles, open } from "./morphology";

/**
 * Speech bubble detection.
 *
 * A manga page is a collage of unrelated text blocks, not a document, so
 * reading the whole page in one pass produces interleaved nonsense. Finding
 * the bubbles first and reading each one separately is what makes the output
 * usable.
 *
 * The method is deliberately plain canvas work rather than OpenCV, which would
 * add roughly eight megabytes to a page that already downloads a language
 * model. A speech bubble is an enclosed light region, bounded by drawn ink,
 * that is roughly convex and has text sized dark marks inside it. Every one of
 * those properties is cheap to measure.
 */

export interface DetectOptions {
  /** Longest edge used for detection. Full resolution is not needed. */
  workingWidth?: number;
  /** Fraction of the page a bubble may occupy, as a guard at both ends. */
  minAreaRatio?: number;
  maxAreaRatio?: number;
  /** How solid the blob must be inside its own bounding box. */
  minFillRatio?: number;
  /** Ink coverage inside the box that reads as text rather than as artwork. */
  minInkRatio?: number;
  maxInkRatio?: number;
/**
   * Largest bounding box, as a fraction of the page's shorter edge, that a
   * dark shape may have and still be treated as lettering to fill in.
   */
  maxGlyphRatio?: number;
  /**
   * Radius used to sever the thin white bridges that join a balloon to the
   * panel it sits on. Larger separates more aggressively but rounds off small
   * balloons.
   */
  openRadius?: number;
}

const DEFAULTS: Required<DetectOptions> = {
  workingWidth: 900,
  minAreaRatio: 0.0012,
  maxAreaRatio: 0.18,
  minFillRatio: 0.35,
  minInkRatio: 0.02,
  maxInkRatio: 0.55,
  maxGlyphRatio: 0.05,
  openRadius: 2,
};

interface Component {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  area: number;
  /** Which page edges this region reaches, used to spot the page background. */
  sides: { left: boolean; right: boolean; top: boolean; bottom: boolean };
}

/**
 * Label every connected run of light pixels.
 *
 * Iterative rather than recursive: a full page white background is hundreds of
 * thousands of pixels and would blow the call stack immediately.
 */
function labelLightRegions(mask: Uint8Array, width: number, height: number): Component[] {
  const labels = new Int32Array(width * height).fill(-1);
  const components: Component[] = [];
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || labels[start] !== -1) continue;

    const id = components.length;
    const component: Component = {
      minX: width,
      minY: height,
      maxX: 0,
      maxY: 0,
      area: 0,
      sides: { left: false, right: false, top: false, bottom: false },
    };

    stack.push(start);
    labels[start] = id;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index / width) | 0;

      component.area++;
      if (x < component.minX) component.minX = x;
      if (y < component.minY) component.minY = y;
      if (x > component.maxX) component.maxX = x;
      if (y > component.maxY) component.maxY = y;
      if (x === 0) component.sides.left = true;
      if (y === 0) component.sides.top = true;
      if (x === width - 1) component.sides.right = true;
      if (y === height - 1) component.sides.bottom = true;

      // Four way connectivity is enough and keeps thin ink lines from
      // leaking two neighbouring bubbles into one component diagonally.
      if (x > 0) push(index - 1);
      if (x < width - 1) push(index + 1);
      if (y > 0) push(index - width);
      if (y < height - 1) push(index + width);
    }

    components.push(component);

    function push(next: number): void {
      if (mask[next] === 1 && labels[next] === -1) {
        labels[next] = id;
        stack.push(next);
      }
    }
  }

  return components;
}

/** Ink coverage inside a box, which is how text is told apart from empty space. */
function inkRatio(mask: Uint8Array, width: number, box: Component): number {
  let dark = 0;
  let total = 0;

  for (let y = box.minY; y <= box.maxY; y++) {
    for (let x = box.minX; x <= box.maxX; x++) {
      total++;
      if (mask[y * width + x] === 0) dark++;
    }
  }

  return total === 0 ? 0 : dark / total;
}

/**
 * Find the bubbles on a page. Returns boxes in the coordinate space of the
 * source image, sorted in reading order.
 */
export function detectBubbles(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, options: DetectOptions = {}): Box[] {
  const settings = { ...DEFAULTS, ...options };

  const scale = Math.min(1, settings.workingWidth / sourceWidth);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const { context } = createCanvas(width, height);
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight, 0, 0, width, height);

  const image = context.getImageData(0, 0, width, height);
  toGreyscale(image.data);
  stretchContrast(image.data);
  binarize(image.data, otsuThreshold(image.data));

  // 1 for light, 0 for ink.
  const inkMask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < image.data.length; i += 4, p++) {
    inkMask[p] = (image.data[i] ?? 0) > 127 ? 1 : 0;
  }

  return boxesFromMask(inkMask, width, height, scale, sourceWidth, sourceHeight, settings);
}

/**
 * The detector proper, working on a binary mask.
 *
 * Kept apart from the canvas work above so it can be run and measured outside
 * a browser. Tuning thresholds against real pages needs a fast loop, and a
 * loop that has to start a browser and a recogniser to try one number is not
 * one anybody will run twice.
 */
export function boxesFromMask(
  inkMask: Uint8Array,
  width: number,
  height: number,
  scale: number,
  sourceWidth: number,
  sourceHeight: number,
  options: DetectOptions = {},
): Box[] {
  const settings = { ...DEFAULTS, ...options };

  /*
   * Fill the lettering first, so each balloon interior is one solid shape
   * rather than a blob full of holes. This is done by bounding box rather than
   * by dilation: a dilation large enough to swallow a glyph also bridges the
   * balloon to the panel behind it, since a balloon outline is no thicker than
   * the lettering it contains.
   *
   * Then open, which severs whatever thin light bridges remain. With the holes
   * already filled the erosion has solid shapes to work on and does not shred
   * the interior around every glyph.
   */
  const maxGlyph = Math.round(Math.min(width, height) * settings.maxGlyphRatio);
  const filled = fillTextHoles(inkMask, width, height, maxGlyph);
  const shapes = open(filled, width, height, settings.openRadius);

  const pageArea = width * height;
  const components = labelLightRegions(shapes, width, height);
  const boxes: Box[] = [];

  for (const component of components) {
    /*
     * The page background reaches nearly every edge. A balloon cropped by the
     * page edge reaches one, or two at a corner, and throwing those away loses
     * the bottom balloon on most webtoon strips, where the artwork is cut into
     * fixed height slices straight through the lettering.
     */
    const sidesTouched = Object.values(component.sides).filter(Boolean).length;
    if (sidesTouched >= 3) continue;

    const areaRatio = component.area / pageArea;
    if (areaRatio < settings.minAreaRatio || areaRatio > settings.maxAreaRatio) continue;

    const boxWidth = component.maxX - component.minX + 1;
    const boxHeight = component.maxY - component.minY + 1;

    // A bubble is roughly convex. A thin sliver of background between panels
    // is not, and this is what rejects most of them.
    const fill = component.area / (boxWidth * boxHeight);
    if (fill < settings.minFillRatio) continue;

    // Extremely long thin regions are panel gutters, not bubbles.
    const ratio = boxWidth / boxHeight;
    if (ratio > 12 || ratio < 1 / 12) continue;

    const ink = inkRatio(inkMask, width, component);
    if (ink < settings.minInkRatio || ink > settings.maxInkRatio) continue;

    // Pad outward a little: the interior component stops at the ink outline,
    // and characters can sit right against it.
    const pad = Math.round(Math.max(boxWidth, boxHeight) * 0.04) + 2;

    boxes.push({
      x: Math.max(0, Math.round((component.minX - pad) / scale)),
      y: Math.max(0, Math.round((component.minY - pad) / scale)),
      width: Math.min(sourceWidth, Math.round((boxWidth + pad * 2) / scale)),
      height: Math.min(sourceHeight, Math.round((boxHeight + pad * 2) / scale)),
    });
  }

  return sortReadingOrder(boxes);
}

/**
 * Right to left, top to bottom, which is how a Japanese page is read.
 * Boxes on roughly the same line are grouped before ordering across.
 */
export function sortReadingOrder(boxes: Box[], rightToLeft = true): Box[] {
  const rowTolerance = 40;

  return [...boxes].sort((a, b) => {
    const sameRow = Math.abs(a.y - b.y) < rowTolerance;
    if (!sameRow) return a.y - b.y;
    return rightToLeft ? b.x - a.x : a.x - b.x;
  });
}

/**
 * Vertical text is the norm in Japanese manga and the recogniser needs to be
 * told, because the horizontal model reads a vertical column as a stack of
 * unrelated single characters.
 */
export function looksVertical(box: Box): boolean {
  return box.height / box.width > 1.35;
}
