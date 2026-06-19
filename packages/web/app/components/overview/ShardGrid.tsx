import { css, type Handle } from "remix/ui"
import type { ShardInfo } from "../../types/overview.js"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  panel: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1rem 1.25rem",
    flex: 1,
    minWidth: 0
  }),
  title: css({
    fontSize: ".72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: tk.mutedFg,
    marginBottom: ".75rem"
  }),
  grid: css({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: ".4rem"
  }),
  cell: css({
    aspectRatio: "1",
    borderRadius: tk.radiusSm,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: ".7rem",
    fontWeight: 600,
    fontFamily: tk.fontMono,
    transition: "background 0.2s, color 0.2s"
  }),
  cellAssigned: css({
    background: "rgba(34,197,94,0.18)",
    color: "#22c55e",
    border: "1px solid rgba(34,197,94,0.25)"
  }),
  cellUnassigned: css({
    background: "rgba(255,255,255,0.04)",
    color: tk.dimmedFg,
    border: `1px solid ${tk.borderLight}`
  }),
  legend: css({
    display: "flex",
    gap: "1rem",
    marginTop: ".75rem"
  }),
  legendItem: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem",
    fontSize: ".68rem",
    color: tk.mutedFg
  }),
  legendSwatch: css({
    width: ".5rem",
    height: ".5rem",
    borderRadius: "2px",
    flexShrink: 0
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShardGrid(handle: Handle<{ shards: ReadonlyArray<ShardInfo> }>) {
  return () => {
    const { shards } = handle.props
    const assigned = shards.filter((s) => s.status === "assigned").length

    return (
      <div mix={s.panel}>
        <div mix={s.title}>Shard Distribution</div>
        <div mix={s.grid}>
          {shards.map((shard) => (
            <div
              key={shard.id}
              mix={[s.cell, shard.status === "assigned" ? s.cellAssigned : s.cellUnassigned]}
            >
              {shard.id}
            </div>
          ))}
        </div>
        <div mix={s.legend}>
          <div mix={s.legendItem}>
            <span
              mix={s.legendSwatch}
              style={{ background: "rgba(34,197,94,0.5)" }}
            />
            {assigned} assigned
          </div>
          <div mix={s.legendItem}>
            <span
              mix={s.legendSwatch}
              style={{ background: tk.dimmedFg }}
            />
            {shards.length - assigned} unassigned
          </div>
        </div>
      </div>
    )
  }
}
