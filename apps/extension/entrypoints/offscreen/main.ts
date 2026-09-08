import { runOcr } from "../../lib/ocr-runner";
import type { OcrRequest, OcrResponse } from "../../lib/messages";

/**
 * The offscreen document exists for Chrome specifically: its service worker
 * has no DOM, so it cannot decode an image or hand a canvas to Tesseract.
 * This page exists purely to provide that DOM. Firefox never loads this
 * file at all, since its background page already has one, see
 * lib/ocr-runner.ts for where the two paths meet back up.
 *
 * It stays alive between pages so the language model is downloaded once
 * rather than on every page turn.
 */

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "ocr") return false;
  const request = message as OcrRequest;
  void runOcr(request.dataUrl, request.script).then((result: OcrResponse) => sendResponse(result));
  return true;
});
