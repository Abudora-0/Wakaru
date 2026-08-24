"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LANGUAGES, searchLanguages, type Language } from "@wakaru/core";

export interface LanguageComboboxProps {
  value: string;
  onChange: (code: string) => void;
  label: string;
  /** Adds an "auto detect" option at the top, for the source side. */
  allowAuto?: boolean;
  id?: string;
}

const AUTO: Language = {
  code: "auto",
  name: "Detect language",
  native: "Detect language",
  script: "Latn",
  dir: "ltr",
  family: "",
  sample: "?",
  dialects: [],
};

/**
 * A real ARIA combobox rather than a styled native select.
 *
 * The native control cannot show a sample of each script, cannot group by
 * writing system and cannot be drawn as a manga panel, so it is rebuilt here.
 * That means the keyboard contract has to be honoured by hand: arrow keys move
 * the active option, typing filters, Enter commits, Escape reverts and focus
 * returns to the trigger.
 */
export function LanguageCombobox({ value, onChange, label, allowAuto = false, id }: LanguageComboboxProps) {
  const generatedId = useId();
  const comboId = id ?? generatedId;
  const listboxId = `${comboId}-listbox`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(() => {
    const found = query.trim() ? searchLanguages(query) : [...LANGUAGES];
    return allowAuto && !query.trim() ? [AUTO, ...found] : found;
  }, [query, allowAuto]);

  const selected = useMemo(() => {
    if (value === "auto") return AUTO;
    return LANGUAGES.find((language) => language.code === value);
  }, [value]);

  // Close when focus or a click leaves the component entirely.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      // Focus the filter field, not the list, so typing narrows immediately.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function commit(code: string) {
    onChange(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter": {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) commit(option.code);
        break;
      }
      case "Escape":
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  }

  const activeOption = options[activeIndex];

  return (
    <div className="wk-combo" ref={rootRef}>
      <label className="wk-caps" htmlFor={comboId} style={{ display: "block", marginBottom: "var(--wk-s-1)" }}>
        {label}
      </label>

      <button
        id={comboId}
        ref={triggerRef}
        type="button"
        className="wk-combo__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((was) => !was)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="wk-combo__glyph" aria-hidden="true">
          {selected?.sample ?? "?"}
        </span>
        <span className="wk-combo__label">
          {selected ? (selected.code === "auto" ? selected.name : selected.native) : "Choose a language"}
        </span>
        <span className="wk-combo__caret" aria-hidden="true" />
      </button>

      {open ? (
        <div className="wk-listbox" role="presentation">
          <div className="wk-listbox__search">
            <input
              ref={searchRef}
              type="text"
              className="wk-field wk-field--boxed"
              placeholder="Filter by name, endonym or code"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={activeOption ? `${comboId}-opt-${activeOption.code}` : undefined}
              aria-label={`${label}, filter languages`}
            />
          </div>

          <ul id={listboxId} ref={listRef} role="listbox" aria-label={label} style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {options.length === 0 ? (
              <li className="wk-option" role="presentation" style={{ color: "var(--wk-text-muted)" }}>
                Nothing matches that.
              </li>
            ) : null}

            {options.map((language, index) => (
              <li
                key={language.code}
                id={`${comboId}-opt-${language.code}`}
                role="option"
                className="wk-option"
                data-index={index}
                data-active={index === activeIndex}
                aria-selected={language.code === value}
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => commit(language.code)}
              >
                <span className="wk-option__native" lang={language.code} aria-hidden="true">
                  {language.sample}
                </span>
                <span className="wk-option__body">
                  <span lang={language.code === "auto" ? "en" : language.code} dir={language.dir}>
                    {language.native}
                  </span>
                  <span className="wk-option__meta">
                    {language.code === "auto"
                      ? "any source language"
                      : `${language.name} / ${language.code}${language.dialects.length > 0 ? ` / ${language.dialects.length} dialects` : ""}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
