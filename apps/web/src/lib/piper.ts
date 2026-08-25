"use client";

import { PIPER_MODEL_MB, piperVoiceFor } from "@wakaru/core";

/**
 * Browser side Piper.
 *
 * The runtime and the ONNX model are large, so nothing here is imported until
 * a voice is actually needed. A static import would put the whole inference
 * stack in the main bundle for every visitor, including the ones whose
 * machine already has a perfectly good system voice.
 */

export interface PiperProgress {
  /** 0 to 1 while a model downloads. */
  value: number;
  megabytes: number;
}

type VitsModule = typeof import("@diffusionstudio/vits-web");

let modulePromise: Promise<VitsModule> | null = null;

function loadModule(): Promise<VitsModule> {
  modulePromise ??= import("@diffusionstudio/vits-web");
  return modulePromise;
}

/** Whether a model for this language is already on disk, so playback is instant. */
export async function isVoiceReady(lang: string): Promise<boolean> {
  const voiceId = piperVoiceFor(lang);
  if (!voiceId) return false;

  try {
    const vits = await loadModule();
    const stored = await vits.stored();
    return stored.includes(voiceId as never);
  } catch {
    return false;
  }
}

export interface SynthesisResult {
  url: string;
  /** Revoke when finished. Object URLs are not garbage collected on their own. */
  release: () => void;
}

/**
 * Synthesise speech locally, downloading the voice first if this is the first
 * time this language has been asked for.
 */
export async function synthesise(
  text: string,
  lang: string,
  onProgress?: (progress: PiperProgress) => void,
): Promise<SynthesisResult> {
  const voiceId = piperVoiceFor(lang);
  if (!voiceId) throw new Error(`no Piper voice for ${lang}`);

  const vits = await loadModule();

  const stored = await vits.stored();
  if (!stored.includes(voiceId as never)) {
    await vits.download(voiceId as never, (progress) => {
      const value = progress.total > 0 ? progress.loaded / progress.total : 0;
      onProgress?.({ value, megabytes: PIPER_MODEL_MB });
    });
  }

  const wav = await vits.predict({ text, voiceId: voiceId as never });
  const url = URL.createObjectURL(wav);

  return { url, release: () => URL.revokeObjectURL(url) };
}

/** Free the cached models. Offered in the interface because they are large. */
export async function forgetVoices(): Promise<void> {
  const vits = await loadModule();
  await vits.flush();
}

/** Which voices are already downloaded, for the storage readout. */
export async function storedVoices(): Promise<string[]> {
  try {
    const vits = await loadModule();
    return [...(await vits.stored())];
  } catch {
    return [];
  }
}
