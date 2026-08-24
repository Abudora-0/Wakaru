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
export function fillTextHoles(
  mask: Uint8Array,
  width: number,
  height: number,
  maxGlyph: number,
): Uint8Array {
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
