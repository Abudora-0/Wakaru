/**
 * Binary morphology on the light mask.
 *
 * Two problems on a real manga page need this, and neither is solvable by
 * tuning a threshold:
 *
 *   Balloons sit on a white panel background. The balloon interior and the
 *   panel interior are the same white, so a plain connected component labels
 *   an entire panel as one region and every balloon inside it is lost.
 *
 *   Text inside a balloon is dark, so the interior is not one blob but a blob
 *   full of holes. Anything that erodes the mask to break the panel connection
 *   would shred the interior around every glyph first.
 *
 * The answer is the standard pair, in this order:
 *
 *   closing  dilate then erode. Swallows the text holes, leaving each balloon
 *            interior as one solid shape.
 *   opening  erode then dilate. Severs the thin white bridges that join a
 *            balloon to the panel around it, then restores the size.
 *
 * Both are separable, so each pass is two linear sweeps rather than a square
 * kernel, which keeps a full page well inside a frame budget.
 */

/** Grow the light region by `radius`, one axis at a time. */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  return sweep(sweep(mask, width, height, radius, true), width, height, radius, false);
}

/** Shrink the light region by `radius`. */
export function erode(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius <= 0) return mask;
  const inverted = invert(mask);
  const grown = sweep(sweep(inverted, width, height, radius, true), width, height, radius, false);
  return invert(grown);
}

/** Fill dark holes smaller than the radius. Used to swallow text. */
export function close(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return erode(dilate(mask, width, height, radius), width, height, radius);
}

/** Remove light bridges thinner than the radius. Used to separate balloons. */
export function open(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  return dilate(erode(mask, width, height, radius), width, height, radius);
}

function invert(mask: Uint8Array): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) out[i] = mask[i] === 1 ? 0 : 1;
  return out;
}

/**
 * One separable dilation pass.
 *
 * A running count of set pixels inside the window slides across each row or
 * column, so the cost does not grow with the radius.
 */
function sweep(mask: Uint8Array, width: number, height: number, radius: number, horizontal: boolean): Uint8Array {
  const out = new Uint8Array(mask.length);
  const outer = horizontal ? height : width;
  const inner = horizontal ? width : height;
  const step = horizontal ? 1 : width;

  for (let o = 0; o < outer; o++) {
    const base = horizontal ? o * width : o;
    let count = 0;

    // Prime the window at the start of the line.
    for (let i = 0; i <= radius && i < inner; i++) {
      if (mask[base + i * step] === 1) count++;
    }

    for (let i = 0; i < inner; i++) {
      out[base + i * step] = count > 0 ? 1 : 0;

      const leaving = i - radius;
      const entering = i + radius + 1;
      if (leaving >= 0 && mask[base + leaving * step] === 1) count--;
      if (entering < inner && mask[base + entering * step] === 1) count++;
    }
  }

  return out;
}

/**
 * Fill the lettering, without touching the outlines.
 *
 * Closing cannot do this. A dilation large enough to swallow a glyph also
 * bridges a balloon to the panel behind it, because a balloon outline is only
 * two or three pixels thick, the same scale as the lettering inside it. No
 * radius separates the two.
 *
 * The distinction that does hold is topological. A glyph is a dark component
 * whose bounding box is small. A balloon outline is a dark component too, but
 * it is a closed ring, so its bounding box is the whole balloon. Filling dark
 * components by bounding box leaves every outline standing and still turns
 * each balloon interior into one solid shape.
 */
export interface FillTextHolesOptions {
  /**
   * A candidate blob is only filled when the ink density of a window around
   * it, measured in the original mask, is at or below this fraction.
   *
   * Bounding box size alone cannot tell a text stroke from a hair strand or a
   * facial mark: both are small, thin, dark shapes at the same pixel scale.
   * What differs is what surrounds them. A character sits in a balloon
   * interior that is nearly all light apart from the letters themselves,
   * while a stray mark in the artwork sits among denser line work. Measuring
   * the density of a window around the region rather than only its own
   * already small footprint is what tells the two apart.
   */
  maxContextInk?: number;
}

const FILL_DEFAULTS: Required<FillTextHolesOptions> = {
  maxContextInk: 0.35,
};

/**
 * A summed area table over the dark pixels, so the ink density of any
 * rectangular window can be read in constant time rather than by rescanning
 * it for every candidate blob on the page.
 */
function buildDarkIntegral(mask: Uint8Array, width: number, height: number): Int32Array {
  const stride = width + 1;
  const integral = new Int32Array(stride * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    for (let x = 0; x < width; x++) {
      rowSum += mask[y * width + x] === 0 ? 1 : 0;
      integral[(y + 1) * stride + (x + 1)] = (integral[y * stride + (x + 1)] ?? 0) + rowSum;
    }
  }

  return integral;
}

/** Dark pixel count in [x0, x1) by [y0, y1), using the table above. */
function darkCount(integral: Int32Array, width: number, x0: number, y0: number, x1: number, y1: number): number {
  const stride = width + 1;
  return (
    (integral[y1 * stride + x1] ?? 0) -
    (integral[y0 * stride + x1] ?? 0) -
    (integral[y1 * stride + x0] ?? 0) +
    (integral[y0 * stride + x0] ?? 0)
  );
}

export function fillTextHoles(
  mask: Uint8Array,
  width: number,
  height: number,
  maxGlyph: number,
  options: FillTextHolesOptions = {},
): Uint8Array {
  const settings = { ...FILL_DEFAULTS, ...options };
  const darkIntegral = buildDarkIntegral(mask, width, height);

  const out = Uint8Array.from(mask);
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 0 || seen[start] === 1) continue;

    seen[start] = 1;
    stack.push(start);

    const pixels: number[] = [];
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let touchesEdge = false;

    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index / width) | 0;

      pixels.push(index);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;

      if (x > 0) push(index - 1);
      if (x < width - 1) push(index + 1);
      if (y > 0) push(index - width);
      if (y < height - 1) push(index + width);
    }

    // Panel borders and page furniture reach the edge and are not lettering.
    if (touchesEdge) continue;
    if (maxX - minX + 1 > maxGlyph || maxY - minY + 1 > maxGlyph) continue;

    // A window one glyph wide on every side, so the measurement reflects the
    // surroundings rather than only the blob's own already small footprint.
    const x0 = Math.max(0, minX - maxGlyph);
    const y0 = Math.max(0, minY - maxGlyph);
    const x1 = Math.min(width, maxX + 1 + maxGlyph);
    const y1 = Math.min(height, maxY + 1 + maxGlyph);
    const windowArea = (x1 - x0) * (y1 - y0);
    const contextInk = windowArea > 0 ? darkCount(darkIntegral, width, x0, y0, x1, y1) / windowArea : 1;

    if (contextInk > settings.maxContextInk) continue;

    for (const index of pixels) out[index] = 1;

    function push(next: number): void {
      if (mask[next] === 0 && seen[next] === 0) {
        seen[next] = 1;
        stack.push(next);
      }
    }
  }

  return out;
}
