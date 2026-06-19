import { css, type Handle, on } from "remix/ui"
import type { ShardInfo } from "../../types/overview.js"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLS = 20
const CELL = 22 // px per cell (including gap)

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
    minWidth: 0,
    display: "flex",
    flexDirection: "column"
  }),
  title: css({
    fontSize: ".72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: tk.mutedFg,
    marginBottom: ".75rem"
  }),
  gridOuter: css({
    overflowX: "auto",
    overflowY: "hidden",
    flex: 1
  }),
  grid: css({
    display: "grid",
    gridTemplateColumns: `repeat(${COLS}, ${CELL - 4}px)`,
    gap: "2px",
    width: "fit-content"
  }),
  cell: css({
    width: `${CELL - 4}px`,
    height: `${CELL - 4}px`,
    borderRadius: "2px",
    cursor: "pointer",
    position: "relative",
    transition: "background 0.15s, transform 0.1s",
    "&:hover": {
      transform: "scale(1.35)",
      zIndex: 10
    }
  }),
  cellAssigned: css({
    background: "rgba(34,197,94,0.35)",
    border: "1px solid rgba(34,197,94,0.15)"
  }),
  cellUnassigned: css({
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${tk.borderLight}`
  }),
  cellWithEntities: css({
    background: "rgba(34,197,94,0.55)",
    border: "1px solid rgba(34,197,94,0.3)"
  }),
  tooltip: css({
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: "50%",
    transform: "translateX(-50%)",
    padding: ".25rem .5rem",
    borderRadius: tk.radiusSm,
    background: "#1a1d27",
    border: `1px solid ${tk.border}`,
    fontSize: ".65rem",
    fontFamily: tk.fontMono,
    color: tk.fg,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    zIndex: 20,
    boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
  }),
  legend: css({
    display: "flex",
    gap: "1rem",
    marginTop: ".75rem",
    flexWrap: "wrap"
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
  }),
  idle: css({
    textAlign: "center",
    padding: "2rem 1rem",
    color: tk.dimmedFg,
    fontSize: ".8rem",
    lineHeight: 1.6
  }),
  idleIcon: css({
    fontSize: "1.5rem",
    display: "block",
    marginBottom: ".5rem"
  })
}

// ---------------------------------------------------------------------------
// Shard cell
// ---------------------------------------------------------------------------

function ShardCell(handle: Handle<{ shard: ShardInfo }>) {
  let hovered = false

  return () => {
    const { shard } = handle.props
    const isAssigned = shard.status === "assigned"
    const hasEntities = shard.entities !== null && shard.entities > 0

    let cellClass = s.cellUnassigned
    if (isAssigned && hasEntities) cellClass = s.cellWithEntities
    else if (isAssigned) cellClass = s.cellAssigned

    return (
      <div
        mix={[
          s.cell,
          cellClass,
          on("mouseenter", () => {
            hovered = true
            handle.update()
          }),
          on("mouseleave", () => {
            hovered = false
            handle.update()
          })
        ]}
      >
        {hovered && (
          <div mix={s.tooltip}>
            {shard.id}
            {shard.entities !== null && ` · ${shard.entities} ent`}
          </div>
        )}
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// ShardGrid
// ---------------------------------------------------------------------------

export function ShardGrid(handle: Handle<{ shards: ReadonlyArray<ShardInfo> }>) {
  return () => {
    const { shards } = handle.props

    if (shards.length === 0) {
      return (
        <div mix={s.panel}>
          <div mix={s.title}>Shard Distribution</div>
          <div mix={s.idle}>
            <span mix={s.idleIcon}>◻</span>
            No shards configured.
          </div>
        </div>
      )
    }

    const assigned = shards.filter((s) => s.status === "assigned").length
    const withEntities = shards.filter((s) => s.entities !== null && s.entities > 0).length
    const rows = Math.ceil(shards.length / COLS)

    return (
      <div mix={s.panel}>
        <div mix={s.title}>Shard Distribution</div>
        <div mix={s.gridOuter}>
          <div
            mix={s.grid}
            style={{
              gridTemplateRows: `repeat(${rows}, ${CELL - 4}px)`
            }}
          >
            {shards.map((shard) => <ShardCell key={shard.id} shard={shard} />)}
          </div>
        </div>
        <div mix={s.legend}>
          <div mix={s.legendItem}>
            <span mix={s.legendSwatch} style={{ background: "rgba(34,197,94,0.55)" }} />
            {assigned} assigned
          </div>
          <div mix={s.legendItem}>
            <span mix={s.legendSwatch} style={{ background: "rgba(34,197,94,0.35)" }} />
            {withEntities} with entities seen
          </div>
          <div mix={s.legendItem}>
            <span mix={s.legendSwatch} style={{ background: tk.dimmedFg }} />
            {shards.length - assigned} unassigned
          </div>
        </div>
      </div>
    )
  }
}
