import { css, type Handle } from "remix/ui"
import type { NodeInfo } from "../../types/overview.js"
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
  list: css({
    display: "flex",
    flexDirection: "column",
    gap: ".35rem",
    flex: 1
  }),
  row: css({
    display: "flex",
    alignItems: "center",
    gap: ".625rem",
    padding: ".45rem .6rem",
    borderRadius: tk.radiusSm,
    background: "rgba(255,255,255,0.02)",
    fontSize: ".78rem",
    fontFamily: tk.fontMono
  }),
  dot: css({
    width: ".5rem",
    height: ".5rem",
    borderRadius: "50%",
    flexShrink: 0
  }),
  nodeAddr: css({
    fontWeight: 600,
    color: tk.fg,
    minWidth: "6rem"
  }),
  groups: css({
    color: tk.mutedFg,
    fontSize: ".65rem",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "8rem"
  }),
  stats: css({
    display: "flex",
    gap: ".75rem",
    marginLeft: "auto",
    color: tk.dimmedFg
  }),
  stat: css({
    display: "flex",
    alignItems: "center",
    gap: ".2rem"
  }),
  statLabel: css({
    fontSize: ".65rem",
    color: tk.mutedFg
  }),
  idle: css({
    textAlign: "center",
    padding: "2rem 1rem",
    color: tk.dimmedFg,
    fontSize: ".8rem",
    lineHeight: 1.6,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  }),
  idleIcon: css({
    fontSize: "1.5rem",
    display: "block",
    marginBottom: ".5rem"
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmtHeartbeat = (hb: string | null): string => {
  if (!hb) return "—"
  const d = new Date(hb.replace(" ", "T"))
  if (Number.isNaN(d.getTime())) return hb
  const now = Date.now()
  const diff = now - d.getTime()
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ---------------------------------------------------------------------------
// NodeRow
// ---------------------------------------------------------------------------

function NodeRow(handle: Handle<{ node: NodeInfo }>) {
  return () => {
    const { node } = handle.props
    const dotColor = node.status === "healthy" ? "#22c55e" : tk.dimmedFg
    return (
      <div mix={s.row}>
        <span mix={s.dot} style={{ background: dotColor }} />
        <span mix={s.nodeAddr}>{node.id}</span>
        <span mix={s.groups} title={node.groups}>
          {node.groups}
        </span>
        <div mix={s.stats}>
          <span mix={s.stat}>
            <span mix={s.statLabel}>S</span>
            {node.assignedShards}
          </span>
          <span mix={s.stat}>
            <span mix={s.statLabel}>HB</span>
            {fmtHeartbeat(node.lastHeartbeat)}
          </span>
        </div>
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// NodesPanel
// ---------------------------------------------------------------------------

export function NodesPanel(handle: Handle<{ nodes: ReadonlyArray<NodeInfo> }>) {
  return () => {
    const { nodes } = handle.props
    const activeNodes = nodes.filter((n) => n.status === "healthy")

    return (
      <div mix={s.panel}>
        <div mix={s.title}>Cluster Nodes ({activeNodes.length} active)</div>
        {nodes.length === 0 ?
          (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>⚡</span>
              No runners registered.
            </div>
          ) :
          activeNodes.length === 0 ?
          (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>💤</span>
              All runners are stale or offline.
            </div>
          ) :
          (
            <div mix={s.list}>
              {nodes.map((node) => <NodeRow key={node.id} node={node} />)}
            </div>
          )}
      </div>
    )
  }
}
