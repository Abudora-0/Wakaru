/**
 * Sumi Press tokens, mirrored in TypeScript.
 *
 * The CSS custom properties in tokens.css are the source of truth for
 * rendering. This module exists so that code which cannot read CSS variables,
 * such as canvas drawing in the manga overlay and generated brand assets, uses
 * exactly the same values.
 */

export const palette = {
  paper: "#f4efe6",
  paper2: "#eae2d4",
  paper3: "#ded3c0",
  ink: "#14110f",
  ink2: "#3a332c",
  ink3: "#6b6156",
  vermilion: "#d8412f",
  vermilionDeep: "#a82f21",
  indigo: "#2b3a67",
  jade: "#2e6e57",
  amber: "#c9812f",

  night: "#0e0d0c",
  night2: "#171512",
  night3: "#241f1a",
  bone: "#ede6d9",
  bone2: "#bdb3a4",
  bone3: "#8a8074",
  vermilionLift: "#e4553f",
} as const;

export type PaletteKey = keyof typeof palette;

/** Theme resolved values, for canvas and image generation. */
export const themes = {
  light: {
    bg: palette.paper,
    surface: "#fbf8f2",
    surfaceRaised: "#ffffff",
    text: palette.ink,
    textMuted: palette.ink3,
    seal: palette.vermilion,
    sealDeep: palette.vermilionDeep,
    rule: palette.ink,
    onSeal: palette.paper,
  },
  dark: {
    bg: palette.night,
    surface: palette.night2,
    surfaceRaised: palette.night3,
    text: palette.bone,
    textMuted: palette.bone3,
    seal: palette.vermilionLift,
    sealDeep: "#b83a28",
    rule: palette.bone,
    onSeal: "#fff6ef",
  },
} as const;

export type ThemeName = keyof typeof themes;
export type ResolvedTheme = (typeof themes)[ThemeName];

export const fonts = {
  display: '"Zen Antique", "Shippori Mincho", Georgia, "Times New Roman", serif',
  read: '"Newsreader", Georgia, "Iowan Old Style", "Times New Roman", serif',
  ui: '"Zen Kaku Gothic New", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
  ipa: '"Gentium Plus", "Charis SIL", "Doulos SIL", "Noto Serif", serif',
  mono: '"JetBrains Mono", ui-monospace, "SFMono-Regular", "Cascadia Mono", Consolas, monospace',
} as const;

/** 4px base scale, in pixels. */
export const space = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20,
  6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80,
} as const;

export const radius = {
  none: 0,
  hair: 2,
  sm: 3,
  md: 4,
  seal: 999,
} as const;

export const motion = {
  fast: 90,
  base: 160,
  slow: 260,
  page: 420,
  easeStamp: "cubic-bezier(0.2, 0.9, 0.25, 1.2)",
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/** Solid offset shadow, matching --wk-shadow at a given travel distance. */
export function offsetShadow(distance: number, color: string = palette.ink): string {
  return `${distance}px ${distance}px 0 ${color}`;
}

/** Resolve the theme values used when drawing to a canvas. */
export function resolveTheme(name: ThemeName): ResolvedTheme {
  return themes[name];
}
