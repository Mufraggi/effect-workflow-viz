import { css, type Handle } from "remix/ui"
import type { NodeInfo, NodeStatus } from "../../types/overview.js"
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
  list: css({
    display: "flex",
    flexDirection: "column",
    gap: ".35rem"
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
  nodeId: css({
    fontWeight: 600,
    color: tk.fg,
    minWidth: "5.5rem"
  }),
  stats: css({
    display: "flex",
    gap: ".75rem",
    color: tk.dimmedFg,
    marginLeft: "auto"
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
  cpuBar: css({
    width: "3rem",
    height: ".35rem",
    borderRadius: "999px",
    background: tk.borderLight,
    overflow: "hidden",
    flexShrink: 0
  }),
  cpuFill: css({
    height: "100%",
    borderRadius: "999px",
    transition: "width 0.3s"
  })
}

const STATUS_DOT: Record<NodeStatus, string> = {
  healthy: "#22c55e",
  degraded: "#eab308",
  offline: tk.dimmedFg
}

const CPU_COLOR = (pct: number): string => pct > 80 ? "#ef4444" : pct > 60 ? "#eab308" : "#22c55e"

// ---------------------------------------------------------------------------
// NodeRow
// ---------------------------------------------------------------------------

function NodeRow(handle: Handle<{ node: NodeInfo }>) {
  return () => {
    const { node } = handle.props
    return (
      <div mix={s.row}>
        <span
          mix={s.dot}
          style={{ background: STATUS_DOT[node.status] }}
        />
        <span mix={s.nodeId}>{node.id}</span>
        <span style={{ color: tk.mutedFg, fontSize: ".65rem" }}>
          {node.status === "offline" ? "offline" : node.addr}
        </span>
        <div mix={s.stats}>
          <span mix={s.stat}>
            <span mix={s.statLabel}>E</span>
            {node.entities}
          </span>
          <span mix={s.stat}>
            <span mix={s.statLabel}>W</span>
            {node.workflows}
          </span>
        </div>
        {node.status !== "offline" && (
          <div style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
            <div mix={s.cpuBar}>
              <div
                mix={s.cpuFill}
                style={{
                  width: `${node.cpuPct}%`,
                  background: CPU_COLOR(node.cpuPct)
                }}
              />
            </div>
            <span style={{ fontSize: ".65rem", color: tk.dimmedFg, fontFamily: tk.fontMono }}>
              {node.cpuPct}%
            </span>
          </div>
        )}
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
    return (
      <div mix={s.panel}>
        <div mix={s.title}>Cluster Nodes</div>
        <div mix={s.list}>
          {nodes.map((node) => <NodeRow key={node.id} node={node} />)}
        </div>
      </div>
    )
  }
}
