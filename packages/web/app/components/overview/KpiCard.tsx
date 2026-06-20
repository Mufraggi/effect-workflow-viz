import { css, type Handle } from "remix/ui"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KpiCardProps {
  title: string
  value: string | number
  sub?: string
  delta?: number | null
  accent?: "neutral" | "amber" | "green" | "red"
}

// ---------------------------------------------------------------------------
// Accent palette
// ---------------------------------------------------------------------------

const ACCENT: Record<
  Exclude<KpiCardProps["accent"], undefined>,
  { bg: string; border: string; badgeBg: string; badgeFg: string }
> = {
  neutral: {
    bg: tk.card,
    border: tk.border,
    badgeBg: "rgba(255,255,255,0.06)",
    badgeFg: tk.mutedFg
  },
  amber: {
    bg: "rgba(234,179,8,0.04)",
    border: "rgba(234,179,8,0.2)",
    badgeBg: "rgba(234,179,8,0.15)",
    badgeFg: "#eab308"
  },
  green: {
    bg: "rgba(34,197,94,0.04)",
    border: "rgba(34,197,94,0.2)",
    badgeBg: "rgba(34,197,94,0.15)",
    badgeFg: "#22c55e"
  },
  red: {
    bg: "rgba(239,68,68,0.04)",
    border: "rgba(239,68,68,0.2)",
    badgeBg: "rgba(239,68,68,0.15)",
    badgeFg: "#ef4444"
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  card: css({
    borderRadius: tk.radius,
    border: `1px solid`,
    padding: "1rem 1.25rem",
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: ".35rem"
  }),
  title: css({
    fontSize: ".72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: tk.mutedFg
  }),
  value: css({
    fontSize: "1.5rem",
    fontWeight: 700,
    fontFamily: tk.fontMono,
    lineHeight: 1.2,
    letterSpacing: "-.02em"
  }),
  sub: css({
    fontSize: ".72rem",
    color: tk.dimmedFg,
    fontFamily: tk.fontMono
  }),
  deltaRow: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem",
    marginTop: ".15rem"
  }),
  deltaBadge: css({
    display: "inline-flex",
    alignItems: "center",
    padding: ".1rem .45rem",
    borderRadius: "999px",
    fontSize: ".65rem",
    fontWeight: 600,
    fontFamily: tk.fontMono
  }),
  deltaUp: css({
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)"
  }),
  deltaDown: css({
    color: "#ef4444",
    background: "rgba(239,68,68,0.12)"
  }),
  deltaNeutral: css({
    color: tk.mutedFg,
    background: "rgba(255,255,255,0.05)"
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KpiCard(handle: Handle<KpiCardProps>) {
  return () => {
    const { accent = "neutral", delta = null, sub, title, value } = handle.props
    const a = ACCENT[accent]

    const deltaStr = delta === null ? null : delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "0%"
    const deltaClass = delta === null || delta === 0
      ? s.deltaNeutral
      : delta > 0
      ? s.deltaUp
      : s.deltaDown

    return (
      <div
        mix={s.card}
        style={{
          background: a.bg,
          borderColor: a.border
        }}
      >
        <span mix={s.title}>{title}</span>
        <span mix={s.value} style={{ color: accent !== "neutral" ? a.badgeFg : undefined }}>
          {value}
        </span>
        {sub !== undefined && <span mix={s.sub}>{sub}</span>}
        {deltaStr !== null && (
          <div mix={s.deltaRow}>
            <span mix={[s.deltaBadge, deltaClass]}>{deltaStr}</span>
          </div>
        )}
      </div>
    )
  }
}
