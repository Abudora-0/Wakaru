import { recognizePage } from "@wakaru/ocr";
import type { OcrRequest, OcrResponse } from "../../lib/messages";

/**
 * The offscreen document exists for one reason: it has a DOM, so it can decode
 * an image and hand a canvas to Tesseract. The service worker cannot.
 *
 * It stays alive between pages so the language model is downloaded once rather
 * than on every page turn.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ocr") return false;
  void handle(message as OcrRequest).then(sendResponse);
  return true;
});

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("could not decode the image"));
    image.src = dataUrl;
  });
}

async function handle(request: OcrRequest): Promise<OcrResponse> {
  try {
    const image = await loadImage(request.dataUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    const page = await recognizePage(image, width, height, {
      script: request.script,
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
