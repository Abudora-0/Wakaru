import type { OcrRegion, SourceScript } from "@wakaru/ocr";

/**
 * The message protocol between the three contexts.
 *
 * A content script cannot fetch a cross origin image without tainting the
 * canvas, and a service worker has no canvas at all, so the work is split:
 *
 *   content script  finds images, draws the overlay, owns the interface
 *   background      fetches image bytes and talks to the translator
 *   offscreen       has a DOM, so it runs Tesseract
 *
 * Every message is typed here so the three sides cannot drift apart.
 */

export interface ReadPageRequest {
  type: "read-page";
  imageUrl: string;
  script: SourceScript;
  target: string;
}

export interface ReadPageResponse {
  type: "read-page-result";
  regions: TranslatedRegion[];
  width: number;
  height: number;
  error?: string;
}

export interface TranslatedRegion extends OcrRegion {
  translation: string;
}

/** Background asks the offscreen document to recognise an image. */
export interface OcrRequest {
  type: "ocr";
  /** The image as a data URL, which the offscreen document can load safely. */
  dataUrl: string;
  script: SourceScript;
}

export interface OcrResponse {
  type: "ocr-result";
  regions: OcrRegion[];
  width: number;
  height: number;
  error?: string;
}

export interface PingRequest {
  type: "ping";
}

export type ExtensionMessage = ReadPageRequest | OcrRequest | PingRequest;

export interface Settings {
  /** Where the translation endpoint lives. Points at the hosted site by default. */
  apiBase: string;
  script: SourceScript;
  target: string;
  /** Minimum image edge in pixels before the overlay button is offered. */
  minImageSize: number;
  autoScan: boolean;
}

/**
 * The default endpoint is a real deployment of this project.
 *
 * It must never be a guessed or aspirational hostname. wakaru.vercel.app, the
 * obvious guess, is registered to an unrelated JavaScript decompiler, and
 * pointing here would have sent recognised text from people's pages to a
 * stranger's server. Change this to your own deployment, or set it in the
 * popup under Translator endpoint.
 */
export const DEFAULT_SETTINGS: Settings = {
  apiBase: "https://wakaruu.vercel.app",
  script: "japanese",
  target: "en",
  minImageSize: 320,
  autoScan: false,
};

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored } as Settings;
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(patch);
}
