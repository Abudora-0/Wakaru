import { recognizePage } from "@wakaru/ocr";
import type { SourceScript } from "@wakaru/ocr";
import type { OcrResponse } from "./messages";

/**
 * The actual recognition step, shared between two very different homes.
 *
 * Chrome's manifest V3 service worker has no DOM, so it cannot decode an
 * image or hand a canvas to Tesseract. Chrome's fix is an offscreen
 * document, a hidden page created for exactly this purpose. Firefox has no
 * such API and does not need one: WXT builds Firefox as manifest V2 by
 * default, whose background page is a real, persistent page with a DOM,
 * so it can just call this function directly rather than route through a
 * second document. Keeping the recognition step itself in one place means
 * neither browser runs a different version of it.
 */
export async function runOcr(dataUrl: string, script: SourceScript): Promise<OcrResponse> {
  try {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const page = await recognizePage(image, width, height, {
      script,
      detectBubbles: true,
    });

    return { type: "ocr-result", regions: page.regions, width, height };
  } catch (error) {
    return {
      type: "ocr-result",
      regions: [],
      width: 0,
      height: 0,
      error: error instanceof Error ? error.message : "recognition failed",
    };
  }
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode the image"));
    image.src = dataUrl;
  });
}
