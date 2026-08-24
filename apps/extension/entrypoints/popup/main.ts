import { LANGUAGES } from "@wakaru/core";
import { SCRIPT_LABELS, type SourceScript } from "@wakaru/ocr";
import { loadSettings, saveSettings } from "../../lib/messages";
import "@wakaru/tokens/tokens.css";
import "@wakaru/tokens/controls.css";
import "./popup.css";

const SCRIPTS: SourceScript[] = ["japanese", "korean", "chinese-simplified", "chinese-traditional", "english"];

function announce(message: string): void {
  const status = document.querySelector<HTMLParagraphElement>("#status");
  if (!status) return;
  status.textContent = message;
  setTimeout(() => {
    if (status.textContent === message) status.textContent = "";
  }, 1800);
}

async function main(): Promise<void> {
  const settings = await loadSettings();

  // Script chips, matching the chip control on the site.
  const chips = document.querySelector<HTMLDivElement>("#scripts");
  if (chips) {
    for (const script of SCRIPTS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "wk-chip";
      chip.textContent = SCRIPT_LABELS[script];
      chip.dataset.selected = String(settings.script === script);
      chip.setAttribute("aria-pressed", String(settings.script === script));

      chip.addEventListener("click", async () => {
        for (const other of chips.querySelectorAll<HTMLButtonElement>(".wk-chip")) {
          other.dataset.selected = "false";
          other.setAttribute("aria-pressed", "false");
        }
        chip.dataset.selected = "true";
        chip.setAttribute("aria-pressed", "true");
        await saveSettings({ script });
        announce("Saved");
      });

      chips.append(chip);
    }
  }

  // A native select is used here on purpose: a popup is a small, transient
  // surface, and the operating system's own list scrolls and searches better
  // in that context than a rebuilt one would.
  const target = document.querySelector<HTMLSelectElement>("#target");
  if (target) {
    for (const language of LANGUAGES) {
      const option = document.createElement("option");
      option.value = language.code;
      option.textContent = `${language.native} / ${language.name}`;
      option.selected = language.code === settings.target;
      target.append(option);
    }
    target.addEventListener("change", async () => {
      await saveSettings({ target: target.value });
      announce("Saved");
    });
  }

  const minSize = document.querySelector<HTMLInputElement>("#minsize");
  if (minSize) {
    minSize.value = String(settings.minImageSize);
    minSize.addEventListener("change", async () => {
      await saveSettings({ minImageSize: Number(minSize.value) || 320 });
      announce("Saved");
    });
  }

  const apiBase = document.querySelector<HTMLInputElement>("#apibase");
  if (apiBase) {
    apiBase.value = settings.apiBase;
    apiBase.addEventListener("change", async () => {
      await saveSettings({ apiBase: apiBase.value.trim() });
      announce("Saved");
    });
  }
}

void main();
