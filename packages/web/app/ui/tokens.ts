// Dark theme tokens — Grafana/Datadog inspired monitoring UI.
// oklch is used for dynamic tints; hex for fixed brand colours.
export const tk = {
  fontSans: "'Plus Jakarta Sans', system-ui, sans-serif",
  fontSerif: "Lora, Georgia, serif",
  fontMono: "'Roboto Mono', ui-monospace, monospace",

  // Background hierarchy
  bg: "#0b0e14",
  sidebarBg: "#11151c",
  topbarBg: "#0d1017",
  card: "#181c24",

  // Text
  fg: "#e2e5ea",
  mutedFg: "#83899c",
  dimmedFg: "#5b6173",

  // Borders
  border: "#262a34",
  borderLight: "#1e222c",

  // Accent
  primary: "#3b82f6",
  primaryFg: "#ffffff",
  primarySoft: "rgba(59, 130, 246, 0.12)",
  primaryActive: "#2563eb",

  // Semantics
  success: "#22c55e",
  successSoft: "rgba(34, 197, 94, 0.12)",
  warning: "#eab308",
  warningSoft: "rgba(234, 179, 8, 0.12)",
  destructive: "#ef4444",
  destructiveSoft: "rgba(239, 68, 68, 0.12)",

  // Interaction
  hoverBg: "rgba(255, 255, 255, 0.05)",
  hoverBgIntense: "rgba(255, 255, 255, 0.08)",

  // Border radius
  radius: "0.75rem",
  radiusMd: "0.5rem",
  radiusSm: "0.375rem",

  // Layout
  sidebarWidth: "240px",
  topbarHeight: "56px"
} as const

// Status accent colours (matching the dark theme).
export const STATUS_COLOR: Record<string, string> = {
  success: "#22c55e",
  running: "#3b82f6",
  pending: "#eab308",
  failed_app: "#ef4444",
  crashed: "#dc2626",
  interrupted: "#f97316",
  unknown: "#6b7280"
}

// Google Fonts URL matching the original index.html.
export const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Lora:ital,wght@0,400..700;1,400..700&family=Roboto+Mono:wght@400;500;600&display=swap"
