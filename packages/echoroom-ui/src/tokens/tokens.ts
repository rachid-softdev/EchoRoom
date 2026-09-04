/**
 * @echoroom/ui — Design Tokens
 *
 * SINGLE SOURCE OF TRUTH for every visual property.
 * All components MUST import from here — zero hardcoded values.
 *
 * The runtime CSS variables (in styles/tokens.css and web globals.css)
 * are derived from these values.
 */

/* ── Colour palette ───────────────────────────────────────────── */

export const colors = {
  /* Brand */
  primary: "#06b6d4",
  "primary-foreground": "#ffffff",
  secondary: "#f4f4f5",
  "secondary-foreground": "#18181b",
  accent: "#06b6d4",
  "accent-foreground": "#ffffff",

  /* Surface */
  background: "#ffffff",
  foreground: "#09090b",
  card: "#ffffff",
  "card-foreground": "#09090b",
  popover: "#ffffff",
  "popover-foreground": "#09090b",

  /* Muted */
  muted: "#f4f4f5",
  "muted-foreground": "#71717a",

  /* Feedback */
  destructive: "#ef4444",
  "destructive-foreground": "#ffffff",

  /* Utility */
  border: "#e4e4e7",
  input: "#e4e4e7",
  ring: "#06b6d4",

  /* Dark mode overrides (applied via the `.dark` class) */
  dark: {
    background: "#0a0a0b",
    foreground: "#fafafa",
    card: "#141416",
    "card-foreground": "#fafafa",
    popover: "#141416",
    "popover-foreground": "#fafafa",
    primary: "#06b6d4",
    "primary-foreground": "#0a0a0b",
    secondary: "#27272a",
    "secondary-foreground": "#fafafa",
    muted: "#18181b",
    "muted-foreground": "#a1a1aa",
    destructive: "#ef4444",
    "destructive-foreground": "#fafafa",
    border: "#27272a",
    input: "#27272a",
    ring: "#06b6d4",
  },
} as const;

/* ── Typography ───────────────────────────────────────────────── */

export const fonts = {
  family: {
    display: "var(--font-display, Georgia, serif)",
    body: "var(--font-body, ui-sans-serif, system-ui, sans-serif)",
    mono: "ui-monospace, SFMono-Regular, monospace",
  },
  size: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
  },
  weight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.15",
    normal: "1.5",
    relaxed: "1.65",
  },
} as const;

/* ── Spacing (4px base unit) ──────────────────────────────────── */

export const space = {
  0: "0",
  1: "0.25rem",
  2: "0.5rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

/* ── Border radius ────────────────────────────────────────────── */

export const radius = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

/* ── Shadows (elevation) ──────────────────────────────────────── */

export const shadows = {
  0: "none",
  1: "0 4px 20px rgba(0, 0, 0, 0.06)",
  2: "0 8px 24px rgba(0, 0, 0, 0.08)",
  3: "0 20px 50px -15px rgba(0, 0, 0, 0.12)",
} as const;

/* ── Motion ───────────────────────────────────────────────────── */

export const motion = {
  duration: {
    fast: "100ms",
    normal: "200ms",
    slow: "400ms",
  },
  easing: {
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    gentle: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
} as const;

/* ── Breakpoints ──────────────────────────────────────────────── */

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

/* ── z-index scale ────────────────────────────────────────────── */

export const zIndex = {
  dropdown: 100,
  sticky: 200,
  navbar: 300,
  modal: 500,
  tooltip: 600,
  toast: 700,
  overlay: 800,
} as const;

/* ── Unified export ───────────────────────────────────────────── */

export const tokens = {
  color: colors,
  font: fonts,
  space,
  radius,
  shadow: shadows,
  motion,
  breakpoint: breakpoints,
  zIndex,
} as const;

export type Tokens = typeof tokens;
export type ColorKey = keyof typeof colors;
export type FontSizeKey = keyof typeof fonts.size;
export type SpacingKey = keyof typeof space;
export type RadiusKey = keyof typeof radius;
export type ShadowKey = keyof typeof shadows;
