import { css, type Handle } from "remix/ui"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  header: css({
    display: "flex",
    alignItems: "center",
    gap: ".625rem",
    marginTop: "2rem",
    marginBottom: ".75rem"
  }),
  label: css({
    fontSize: ".68rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".08em",
    color: tk.mutedFg
  }),
  line: css({
    flex: 1,
    height: 1,
    background: tk.borderLight,
    minWidth: "2rem"
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SectionHeader(handle: Handle<{ label: string }>) {
  return () => {
    const { label } = handle.props
    return (
      <div mix={s.header}>
        <span mix={s.label}>{label}</span>
        <span mix={s.line} />
      </div>
    )
  }
}
