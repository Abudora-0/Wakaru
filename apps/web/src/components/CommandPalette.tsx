"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, searchLanguages } from "@wakaru/core";
import "./palette.css";

/**
 * The command palette.
 *
 * Wakaru has four surfaces and 107 languages, so the fastest route to any of
 * them is typing rather than navigating. Everything the palette offers is also
 * reachable by clicking: this is an accelerator, not the only path.
 *
 * It is a modal dialog, so it owns focus while open and gives it back on close.
 */

interface Action {
  id: string;
  label: string;
  hint?: string;
  glyph?: string;
  group: string;
  /** Extra terms that should match this action but are not in the label. */
  keywords?: string;
  run: () => void;
}

const THEME_KEY = "wakaru-theme";

function setTheme(theme: "light" | "dark" | "system"): void {
  const root = document.documentElement;
  if (theme === "system") {
    root.removeAttribute("data-theme");
    window.localStorage.removeItem(THEME_KEY);
  } else {
    root.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
    // Hand focus back to whatever opened it, which is what a modal owes the
    // keyboard user who invoked it.
    returnFocusTo.current?.focus();
    returnFocusTo.current = null;
  }, []);

  const show = useCallback(() => {
    returnFocusTo.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);

  // Ctrl+K, or Cmd+K on a Mac.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((wasOpen) => {
          if (wasOpen) {
            setQuery("");
            setActiveIndex(0);
            return false;
          }
          returnFocusTo.current = document.activeElement as HTMLElement | null;
          return true;
        });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const actions = useMemo<Action[]>(() => {
    const term = query.trim();

    const go = (path: string) => () => {
      router.push(path);
      close();
    };

    const navigation: Action[] = [
      { id: "nav-home", label: "Home", hint: "/", glyph: "家", group: "Go to", keywords: "landing front start", run: go("/") },
      { id: "nav-translate", label: "Translate", hint: "/translate", glyph: "訳", group: "Go to", keywords: "spread dialect", run: go("/translate") },
      { id: "nav-dictionary", label: "Dictionary", hint: "/dictionary", glyph: "辞", group: "Go to", keywords: "define word meaning lookup", run: go("/dictionary") },
      { id: "nav-read", label: "Read a raw page", hint: "/read", glyph: "読", group: "Go to", keywords: "manga manhwa ocr scan", run: go("/read") },
      { id: "nav-languages", label: "Languages and dialects", hint: "/languages", glyph: "語", group: "Go to", keywords: "specimen script coverage", run: go("/languages") },
    ];

    const theme: Action[] = [
      { id: "theme-light", label: "Switch to Paper", glyph: "日", group: "Appearance", keywords: "light theme", run: () => { setTheme("light"); close(); } },
      { id: "theme-dark", label: "Switch to Night Ink", glyph: "月", group: "Appearance", keywords: "dark theme", run: () => { setTheme("dark"); close(); } },
      { id: "theme-system", label: "Follow the system theme", glyph: "自", group: "Appearance", keywords: "auto system", run: () => { setTheme("system"); close(); } },
    ];

    // A free text query is almost always a word someone wants defined, so that
    // offer goes to the top rather than being buried under navigation.
    const lookup: Action[] = term
      ? [
          {
            id: "lookup",
            label: `Look up "${term}"`,
            hint: "dictionary",
            glyph: "分",
            group: "Search",
            run: go(`/dictionary/en/${encodeURIComponent(term)}`),
          },
        ]
      : [];

    const languages: Action[] = (term ? searchLanguages(term, 6) : []).map((language) => ({
      id: `lang-${language.code}`,
      label: language.native,
      hint: `${language.name} / ${language.code}`,
      glyph: language.sample,
      group: "Languages",
      keywords: `${language.name} ${language.code} ${language.family}`,
      run: go(`/dictionary/${language.code}`),
    }));

    const lower = term.toLowerCase();

    const matches = (action: Action) => {
      if (!term) return true;
      const haystack = `${action.label} ${action.hint ?? ""} ${action.keywords ?? ""}`.toLowerCase();
      return haystack.includes(lower);
    };

    /**
     * A hit on the command's own name outranks the offer to define the text.
     *
     * Typing "read" should reach the reader, not look up the English word
     * "read", and typing "night ink" should switch the theme. Everything else
     * that is only a keyword match stays below the lookup, because arbitrary
     * text is far more often a word someone wants defined than a command.
     */
    const namedDirectly = (action: Action) => Boolean(term) && action.label.toLowerCase().includes(lower);

    const commands = [...navigation, ...theme].filter(matches);
    const byName = commands.filter(namedDirectly);
    const byKeyword = commands.filter((action) => !namedDirectly(action));

    return term ? [...byName, ...lookup, ...byKeyword, ...languages] : commands;
  }, [query, router, close]);

  // A filter change can leave the cursor past the end of the new list.
  useEffect(() => {
    setActiveIndex((index) => (index >= actions.length ? 0 : index));
  }, [actions.length]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  /*
   * The accessible name is set explicitly rather than composed from the
   * visible text, because the narrow layout hides that text. A control whose
   * name changes with the viewport is a control screen reader users cannot
   * rely on, and it also makes the label untestable.
   */
  const trigger = (
    <button
      type="button"
      className="palette-hint"
      onClick={show}
      aria-haspopup="dialog"
      aria-label="Open the command palette"
      title="Open the command palette"
    >
      <span aria-hidden="true">Ctrl K</span>
      <span className="palette-hint__label" aria-hidden="true">Search</span>
    </button>
  );

  if (!open) return trigger;

  // Group consecutive actions so each section header is rendered once, while
  // the flat index the keyboard walks stays intact.
  const grouped: { group: string; items: { action: Action; index: number }[] }[] = [];
  actions.forEach((action, index) => {
    const last = grouped[grouped.length - 1];
    if (last && last.group === action.group) last.items.push({ action, index });
    else grouped.push({ group: action.group, items: [{ action, index }] });
  });

  const activeAction = actions[activeIndex];

  return (
    <>
      {trigger}

      <div
        className="scrim"
        role="presentation"
        data-testid="palette-scrim"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <div className="palette__head">
            <span className="palette__seal" aria-hidden="true">分</span>
            <input
              ref={inputRef}
              type="text"
              className="palette__input"
              placeholder="Search languages, jump to a page, or type a word to define"
              value={query}
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-list"
              aria-autocomplete="list"
              aria-activedescendant={activeAction ? `palette-${activeAction.id}` : undefined}
              aria-label="Search commands"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={(event) => {
                const count = actions.length;
                switch (event.key) {
                  case "ArrowDown":
                    event.preventDefault();
                    if (count > 0) setActiveIndex((index) => (index + 1) % count);
                    break;
                  case "ArrowUp":
                    event.preventDefault();
                    if (count > 0) setActiveIndex((index) => (index - 1 + count) % count);
                    break;
                  case "Home":
                    event.preventDefault();
                    setActiveIndex(0);
                    break;
                  case "End":
                    event.preventDefault();
                    setActiveIndex(Math.max(count - 1, 0));
                    break;
                  case "Enter":
                    event.preventDefault();
                    actions[activeIndex]?.run();
                    break;
                  case "Escape":
                    event.preventDefault();
                    close();
                    break;
                  case "Tab":
                    // Nothing else inside the dialog takes focus, so trapping
                    // is simply a matter of keeping the caret where it is.
                    event.preventDefault();
                    break;
                  default:
                    break;
                }
              }}
            />
            <span className="palette__esc" aria-hidden="true">esc</span>
          </div>

          <ul id="palette-list" ref={listRef} className="palette__list" role="listbox" aria-label="Commands">
            {grouped.map((section) => (
              <li key={section.group} role="presentation">
                <div className="palette__group">{section.group}</div>
                <ul role="presentation" style={{ margin: 0, padding: 0, listStyle: "none" }}>
                  {section.items.map(({ action, index }) => (
                    <li
                      key={action.id}
                      id={`palette-${action.id}`}
                      role="option"
                      className="palette__item"
                      data-index={index}
                      data-active={index === activeIndex}
                      aria-selected={index === activeIndex}
                      onPointerEnter={() => setActiveIndex(index)}
                      onClick={() => action.run()}
                    >
                      <span className="palette__glyph" aria-hidden="true">{action.glyph}</span>
                      <span className="palette__label">{action.label}</span>
                      {action.hint ? <span className="palette__hint">{action.hint}</span> : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          <div className="palette__foot">
            <span>up down to move</span>
            <span>enter to run</span>
            <span>esc to close</span>
          </div>
        </div>
      </div>
    </>
  );
}
