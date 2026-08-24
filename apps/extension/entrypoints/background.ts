import { DEFAULT_SETTINGS, loadSettings, type OcrResponse, type ReadPageRequest, type ReadPageResponse, type TranslatedRegion } from "../lib/messages";
import type { OcrRegion } from "@wakaru/ocr";
import { SCRIPT_TO_LANG } from "@wakaru/ocr";

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
      await chrome.storage.sync.set(DEFAULT_SETTINGS);
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "read-page") {
      void handleReadPage(message as ReadPageRequest).then(sendResponse);
      // Returning true keeps the channel open for the async reply.
      return true;
    }
    return false;
  });
});

/* -------------------------------------------------------------- offscreen */

const OFFSCREEN_PATH = "offscreen.html";
let creatingOffscreen: Promise<void> | null = null;

/**
 * The service worker has no DOM, so Tesseract cannot run in it. An offscreen
 * document is the supported way to get a canvas in MV3. Only one may exist at
 * a time, so creation is guarded against concurrent calls.
 */
async function ensureOffscreen(): Promise<void> {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
  });
  if (existing.length > 0) return;

  if (creatingOffscreen) {
    await creatingOffscreen;
    return;
  }

  creatingOffscreen = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["DOM_SCRAPING" as chrome.offscreen.Reason],
    justification: "Runs optical character recognition on a manga page using a canvas.",
  });

  try {
    await creatingOffscreen;
  } finally {
    creatingOffscreen = null;
  }
}

/* ------------------------------------------------------------ image bytes */

/**
 * Fetch the page image here rather than in the content script.
 *
 * Drawing a cross origin image onto a canvas taints it, and a tainted canvas
 * cannot be read back, which would break recognition on essentially every
 * real site. Fetching in the background and passing the bytes on as a data URL
 * sidesteps that completely.
 */
async function fetchAsDataUrl(url: string): Promise<string> {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`image request failed with ${response.status}`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("that URL is not an image");

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("could not decode the image"));
    reader.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------- translation */

async function translateRegions(regions: OcrRegion[], from: string, to: string, apiBase: string): Promise<TranslatedRegion[]> {
  return await Promise.all(
    regions.map(async (region) => {
      try {
        const response = await fetch(`${apiBase.replace(/\/+$/, "")}/api/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: region.text, from, to }),
        });
        if (!response.ok) return { ...region, translation: "" };
        const payload = (await response.json()) as { text?: string };
        return { ...region, translation: payload.text ?? "" };
      } catch {
        return { ...region, translation: "" };
      }
    }),
  );
}

/* ---------------------------------------------------------------- pipeline */

async function handleReadPage(request: ReadPageRequest): Promise<ReadPageResponse> {
  const empty: ReadPageResponse = { type: "read-page-result", regions: [], width: 0, height: 0 };

  try {
    const settings = await loadSettings();
    const dataUrl = await fetchAsDataUrl(request.imageUrl);

    await ensureOffscreen();

    const ocr = (await chrome.runtime.sendMessage({
      type: "ocr",
      dataUrl,
      script: request.script,
    })) as OcrResponse | undefined;

    if (!ocr || ocr.error) {
      return { ...empty, error: ocr?.error ?? "recognition failed" };
    }
    if (ocr.regions.length === 0) {
      return { ...empty, width: ocr.width, height: ocr.height, error: "no readable text on this image" };
    }

    const from = SCRIPT_TO_LANG[request.script];
    const regions = await translateRegions(ocr.regions, from, request.target, settings.apiBase);

    return { type: "read-page-result", regions, width: ocr.width, height: ocr.height };
  } catch (error) {
    return { ...empty, error: error instanceof Error ? error.message : "something went wrong" };
  }
}
