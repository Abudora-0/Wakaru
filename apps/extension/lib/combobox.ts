/**
 * A vanilla build of the site's language picker.
 *
 * The popup is plain TypeScript rather than React, but the control has to be
 * the same object: a native select cannot show a sample of each script, cannot
 * be drawn as a manga panel, and looks like the operating system rather than
 * like Wakaru. So the ARIA combobox pattern is implemented again here, against
 * the same class names in the shared token package.
 */

export interface ComboOption {
  value: string;
  /** What the option calls itself, shown first. */
  label: string;
  /** Secondary line, usually the English name and the code. */
  meta?: string;
  /** A single character of the option's own script. */
  glyph?: string;
  dir?: "ltr" | "rtl";
  lang?: string;
  /** Extra text that should match a filter but is not displayed. */
  search?: string;
}

export interface ComboboxConfig {
  mount: HTMLElement;
  label: string;
  value: string;
  options: ComboOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}

export function createCombobox(config: ComboboxConfig): { setValue: (value: string) => void } {
  const id = `combo-${Math.random().toString(36).slice(2, 8)}`;
  let value = config.value;
  let open = false;
  let activeIndex = 0;
  let filtered = config.options;

  const root = document.createElement("div");
  root.className = "wk-combo";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "wk-combo__trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", config.label);

  const glyph = document.createElement("span");
  glyph.className = "wk-combo__glyph";
  glyph.setAttribute("aria-hidden", "true");

  const labelEl = document.createElement("span");
  labelEl.className = "wk-combo__label";

  const caret = document.createElement("span");
  caret.className = "wk-combo__caret";
  caret.setAttribute("aria-hidden", "true");

  trigger.append(glyph, labelEl, caret);
  root.append(trigger);
  config.mount.append(root);

  let panel: HTMLDivElement | null = null;
  let search: HTMLInputElement | null = null;
  let list: HTMLUListElement | null = null;

  function selected(): ComboOption | undefined {
    return config.options.find((option) => option.value === value);
  }

  function paintTrigger(): void {
    const option = selected();
    glyph.textContent = option?.glyph ?? "?";
    labelEl.textContent = option?.label ?? config.placeholder ?? "Choose";
    if (option?.lang) labelEl.lang = option.lang;
    if (option?.dir) labelEl.dir = option.dir;
  }

  function matches(option: ComboOption, term: string): boolean {
    if (!term) return true;
    const hay = `${option.label} ${option.meta ?? ""} ${option.search ?? ""} ${option.value}`.toLowerCase();
    return hay.includes(term.toLowerCase());
  }

  function paintList(): void {
    if (!list) return;
    list.replaceChildren();

    filtered.forEach((option, index) => {
      const item = document.createElement("li");
      item.className = "wk-option";
      item.id = `${id}-opt-${option.value}`;
      item.setAttribute("role", "option");
      item.dataset.index = String(index);
      item.dataset.active = String(index === activeIndex);
      item.setAttribute("aria-selected", String(option.value === value));

      const native = document.createElement("span");
      native.className = "wk-option__native";
      native.setAttribute("aria-hidden", "true");
      native.textContent = option.glyph ?? "";

      const body = document.createElement("span");
      body.className = "wk-option__body";

      const primary = document.createElement("span");
      primary.textContent = option.label;
      if (option.lang) primary.lang = option.lang;
      if (option.dir) primary.dir = option.dir;

      body.append(primary);

      if (option.meta) {
        const meta = document.createElement("span");
        meta.className = "wk-option__meta";
        meta.textContent = option.meta;
        body.append(meta);
      }

      item.append(native, body);
      item.addEventListener("pointerenter", () => setActive(index));
      item.addEventListener("click", () => commit(option.value));
      list?.append(item);
    });

    const active = filtered[activeIndex];
    if (active && search) search.setAttribute("aria-activedescendant", `${id}-opt-${active.value}`);
  }

  function setActive(index: number): void {
    activeIndex = index;
    list?.querySelectorAll<HTMLElement>(".wk-option").forEach((node) => {
      node.dataset.active = String(Number(node.dataset.index) === index);
    });
    const active = filtered[index];
    if (active && search) search.setAttribute("aria-activedescendant", `${id}-opt-${active.value}`);
    list?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }

  function commit(next: string): void {
    value = next;
    paintTrigger();
    close();
    config.onChange(next);
  }

  function close(): void {
    if (!open) return;
    open = false;
    trigger.setAttribute("aria-expanded", "false");
    panel?.remove();
    panel = null;
    search = null;
    list = null;
    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    trigger.focus();
  }

  function onDocumentPointerDown(event: PointerEvent): void {
    if (!root.contains(event.target as Node)) close();
  }

  function show(): void {
    if (open) return;
    open = true;
    activeIndex = Math.max(
      0,
      config.options.findIndex((option) => option.value === value),
    );
    filtered = config.options;

    trigger.setAttribute("aria-expanded", "true");

    panel = document.createElement("div");
    panel.className = "wk-listbox";

    const searchWrap = document.createElement("div");
    searchWrap.className = "wk-listbox__search";

    search = document.createElement("input");
    search.type = "text";
    search.className = "wk-field wk-field--boxed";
    search.placeholder = "Filter";
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute("role", "combobox");
    search.setAttribute("aria-expanded", "true");
    search.setAttribute("aria-controls", `${id}-list`);
    search.setAttribute("aria-autocomplete", "list");
    search.setAttribute("aria-label", `${config.label}, filter`);

    searchWrap.append(search);

    list = document.createElement("ul");
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", config.label);
    list.style.margin = "0";
    list.style.padding = "0";
    list.style.listStyle = "none";

    panel.append(searchWrap, list);
    root.append(panel);

    paintList();
    setActive(activeIndex);

    search.addEventListener("input", () => {
      filtered = config.options.filter((option) => matches(option, search?.value ?? ""));
      activeIndex = 0;
      paintList();
    });

    search.addEventListener("keydown", (event) => {
      const count = filtered.length;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (count) setActive((activeIndex + 1) % count);
          break;
        case "ArrowUp":
          event.preventDefault();
          if (count) setActive((activeIndex - 1 + count) % count);
          break;
        case "Home":
          event.preventDefault();
          if (count) setActive(0);
          break;
        case "End":
          event.preventDefault();
          if (count) setActive(count - 1);
          break;
        case "Enter": {
          event.preventDefault();
          const option = filtered[activeIndex];
          if (option) commit(option.value);
          break;
        }
        case "Escape":
          event.preventDefault();
          close();
          break;
        case "Tab":
          close();
          break;
        default:
          break;
      }
    });

    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    requestAnimationFrame(() => search?.focus());
  }

  trigger.addEventListener("click", () => (open ? close() : show()));
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      show();
    }
  });

  paintTrigger();

  return {
    setValue(next: string) {
      value = next;
      paintTrigger();
    },
  };
}
