import { css } from "remix/ui"
import { tk } from "../ui/tokens.js"

/** Shared styling for the centered auth cards (login + setup). */
export const authStyles = {
  body: css({
    margin: 0,
    fontFamily: tk.fontSans,
    color: tk.fg,
    background: tk.bg,
    minHeight: "100vh"
  }),
  shell: css({
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "2rem"
  }),
  card: css({
    width: "100%",
    maxWidth: "24rem",
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "2rem"
  }),
  badge: css({
    alignSelf: "flex-start",
    padding: ".2rem .6rem",
    borderRadius: "999px",
    fontSize: ".7rem",
    fontFamily: tk.fontMono,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.primary,
    background: tk.primarySoft
  }),
  h1: css({
    margin: 0,
    fontFamily: tk.fontSerif,
    fontSize: "1.6rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  muted: css({ color: tk.mutedFg, fontSize: ".9rem", margin: 0 }),
  hint: css({ color: tk.mutedFg, fontSize: ".75rem" }),
  error: css({
    padding: ".6rem .8rem",
    borderRadius: tk.radiusSm,
    fontSize: ".85rem",
    color: tk.destructive,
    border: `1px solid ${tk.destructive}`,
    background: "color-mix(in oklch, oklch(0.6368 0.2078 25.3313) 10%, transparent)"
  }),
  field: css({ display: "flex", flexDirection: "column", gap: ".4rem" }),
  lbl: css({
    fontSize: ".7rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg
  }),
  input: css({
    padding: ".55rem .7rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".9rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  btn: css({
    marginTop: ".5rem",
    padding: ".6rem 1rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".9rem",
    fontWeight: 600,
    cursor: "pointer"
  }),
  btnPrimary: css({
    border: `1px solid ${tk.primary}`,
    color: tk.primaryFg,
    background: tk.primary,
    "&:hover": { opacity: 0.9 }
  })
} as const
