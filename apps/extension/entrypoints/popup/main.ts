import { LANGUAGES } from "@wakaru/core";
import { SCRIPT_LABELS, type SourceScript } from "@wakaru/ocr";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "../../lib/messages";
import { createCombobox } from "../../lib/combobox";
import "@wakaru/tokens/tokens.css";
import "@wakaru/tokens/controls.css";
import "./popup.css";

const SCRIPTS: SourceScript[] = ["japanese", "korean", "chinese-simplified", "chinese-traditional", "english"];

const MIN_SIZE = 80;
const MAX_SIZE = 2000;
const SIZE_STEP = 20;

/** A short confirmation, since every control here saves on change. */
function announce(message: string): void {
  const status = document.querySelector<HTMLElement>("#status");
  if (!status) return;

  status.textContent = message;
  status.dataset.shown = "true";

  window.setTimeout(() => {
    if (status.textContent === message) {
      status.dataset.shown = "false";
      status.textContent = "";
    }
  }, 1600);
}

function mountScripts(current: SourceScript): void {
  const chips = document.querySelector<HTMLDivElement>("#scripts");
  if (!chips) return;

  for (const script of SCRIPTS) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "wk-chip";
    chip.textContent = SCRIPT_LABELS[script];
    chip.dataset.selected = String(current === script);
    chip.setAttribute("aria-pressed", String(current === script));

    chip.addEventListener("click", () => {
      for (const other of chips.querySelectorAll<HTMLButtonElement>(".wk-chip")) {
        other.dataset.selected = "false";
        other.setAttribute("aria-pressed", "false");
      }
      chip.dataset.selected = "true";
      chip.setAttribute("aria-pressed", "true");
      void saveSettings({ script }).then(() => announce("Saved"));
    });

    chips.append(chip);
  }
}

function mountTarget(current: string): void {
  const mount = document.querySelector<HTMLElement>("#target");
  if (!mount) return;

  createCombobox({
    mount,
    label: "Translate into",
    value: current,
    placeholder: "Choose a language",
    options: LANGUAGES.map((language) => ({
      value: language.code,
      label: language.native,
      meta: `${language.name} / ${language.code}`,
      glyph: language.sample,
      dir: language.dir,
      lang: language.code,
      search: `${language.name} ${language.family}`,
    })),
    onChange: (target) => {
      void saveSettings({ target }).then(() => announce("Saved"));
    },
  });
}

function mountSize(current: number): void {
  const input = document.querySelector<HTMLInputElement>("#minsize");
  const down = document.querySelector<HTMLButtonElement>("#minsize-down");
  const up = document.querySelector<HTMLButtonElement>("#minsize-up");
  if (!input || !down || !up) return;

  const clamp = (value: number) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, value));

  function paint(value: number, save: boolean): void {
    const next = clamp(value);
    input.value = String(next);
    down.disabled = next <= MIN_SIZE;
    up.disabled = next >= MAX_SIZE;
    if (save) void saveSettings({ minImageSize: next }).then(() => announce("Saved"));
  }

  paint(current, false);

  down.addEventListener("click", () => paint(Number(input.value) - SIZE_STEP, true));
  up.addEventListener("click", () => paint(Number(input.value) + SIZE_STEP, true));

  // Typing straight into the field is still allowed, and is clamped on blur so
  // a half typed number is not rejected mid keystroke.
  input.addEventListener("change", () => paint(Number(input.value) || DEFAULT_SETTINGS.minImageSize, true));
}

function mountEndpoint(current: string): void {
  const input = document.querySelector<HTMLInputElement>("#apibase");
  if (!input) return;

  input.value = current;
  input.addEventListener("change", () => {
    const next = input.value.trim() || DEFAULT_SETTINGS.apiBase;
    input.value = next;
    void saveSettings({ apiBase: next }).then(() => announce("Saved"));
  });
}

async function main(): Promise<void> {
  const settings = await loadSettings();

  mountScripts(settings.script);
  mountTarget(settings.target);
  mountSize(settings.minImageSize);
  mountEndpoint(settings.apiBase);
}

void main();
