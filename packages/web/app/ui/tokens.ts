// Design tokens ported from the original front (packages/front/src/index.css),
// light theme. oklch() is used directly (natively supported by browsers).
export const tk = {
  fontSans: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontSerif: "Lora, Georgia, serif",
  fontMono: "'Roboto Mono', ui-monospace, monospace",
  bg: "oklch(0.9232 0.0026 48.7171)",
  fg: "oklch(0.2795 0.0368 260.031)",
  card: "oklch(0.9699 0.0013 106.4238)",
  primary: "oklch(0.5854 0.2041 277.1173)",
  primaryFg: "oklch(1 0 0)",
  border: "oklch(0.8687 0.0043 56.366)",
  mutedFg: "oklch(0.551 0.0234 264.3637)",
  secondary: "oklch(0.8687 0.0043 56.366)",
  destructive: "oklch(0.6368 0.2078 25.3313)",
  radius: "1.25rem",
  radiusMd: "1rem",
  radiusSm: "0.75rem",
  // soft tints (color-mix is natively supported)
  primarySoft: "color-mix(in oklch, oklch(0.5854 0.2041 277.1173) 14%, transparent)",
  hoverBg: "color-mix(in oklch, oklch(0.8687 0.0043 56.366) 45%, transparent)"
} as const

// Status accent colors (text + faint background via 8-digit hex alpha).
export const STATUS_COLOR: Record<string, string> = {
  success: "#15803d",
  running: "#1d4ed8",
  pending: "#a16207",
  failed_app: "#dc2626",
  crashed: "#b91c1c",
  interrupted: "#c2410c",
  unknown: "#71717a"
}

// Google Fonts URL matching the original index.html.
export const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400..700;1,400..700&family=Roboto+Mono:wght@400;500;600&display=swap"
