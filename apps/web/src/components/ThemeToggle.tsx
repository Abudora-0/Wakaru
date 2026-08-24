"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "wakaru-theme";

/**
 * Paper and Night Ink.
 *
 * The three states matter: an explicit choice stamps data-theme on the root so
 * it beats the operating system in both directions, while "system" removes the
 * attribute and lets prefers-color-scheme decide.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") {
      root.removeAttribute("data-theme");
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute("data-theme", next);
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }

  // Until mounted the stored preference is unknown, so render a stable label
  // rather than flashing the wrong one.
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      className="wk-btn wk-btn--sm wk-btn--quiet"
      onClick={() => apply(isDark ? "light" : "dark")}
      aria-pressed={isDark}
      title={isDark ? "Switch to Paper" : "Switch to Night Ink"}
    >
      <span aria-hidden="true" style={{ fontFamily: "var(--wk-font-display)" }}>
        {isDark ? "日" : "月"}
      </span>
      <span className="wk-sr-only">{isDark ? "Switch to the light theme" : "Switch to the dark theme"}</span>
    </button>
  );
}
