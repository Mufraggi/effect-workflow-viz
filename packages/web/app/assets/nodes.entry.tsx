import { clientEntry, css, type EntryComponent, type Handle, type SerializableProps } from "remix/ui"
import type { OverviewSnapshot } from "../types/overview.js"
import { tk } from "../ui/tokens.js"
import { fmtRelative } from "../utils/runs.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NodesEntryProps extends SerializableProps {
  initialSnapshot: OverviewSnapshot
  // Server render time; threaded into relative-time formatting so SSR and
  // hydration produce identical text. See `fmtRelative` in utils/runs.ts.
  nowMs: number
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  container: css({
    maxWidth: "80rem",
    margin: "0 auto",
    padding: "2rem 2rem 3rem"
  }),
  headerRow: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    marginBottom: "1.5rem"
  }),
  h1: css({
    margin: "0 0 .25rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  muted: css({ color: tk.mutedFg, fontSize: ".85rem", margin: 0 }),
  // Node grid
  nodeGrid: css({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(28rem, 1fr))",
    gap: ".75rem",
    marginBottom: "2rem"
  }),
  // Node card
  nodeCard: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: ".5rem",
    transition: "opacity .2s"
  }),
  nodeCardStale: css({
    opacity: 0.55
  }),
  nodeHeader: css({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: ".75rem"
  }),
  nodeAddr: css({
    fontFamily: tk.fontMono,
    fontSize: ".88rem",
    fontWeight: 600,
    color: tk.fg,
    overflow: "hidden",
    textOverflow: "ellipsis"
  }),
  nodeMeta: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: ".15rem 1rem",
    fontSize: ".78rem"
  }),
  metaLabel: css({
    color: tk.mutedFg
  }),
  metaValue: css({
    color: tk.fg,
    fontFamily: tk.fontMono,
    fontSize: ".75rem"
  }),
  // Status badge
  statusBadge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".3rem",
    padding: ".15rem .55rem",
    borderRadius: "999px",
    fontSize: ".68rem",
    fontWeight: 600,
    fontFamily: tk.fontMono,
    flexShrink: 0
  }),
  badgeActive: css({
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)"
  }),
  badgeStale: css({
    color: tk.dimmedFg,
    background: "rgba(128,128,128,0.1)"
  }),
  statusDot: css({
    width: ".4rem",
    height: ".4rem",
    borderRadius: "50%",
    flexShrink: 0
  }),
  // Config panel
  configPanel: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1rem 1.5rem",
    maxWidth: "32rem"
  }),
  configTitle: css({
    fontSize: ".72rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".04em",
    color: tk.mutedFg,
    marginBottom: ".75rem"
  }),
  configGrid: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: ".3rem 1.5rem",
    fontSize: ".82rem"
  }),
  configLabel: css({
    color: tk.mutedFg
  }),
  configValue: css({
    color: tk.fg,
    fontFamily: tk.fontMono,
    fontSize: ".78rem"
  }),
  // Empty / idle
  idle: css({
    textAlign: "center",
    padding: "4rem 2rem",
    color: tk.mutedFg
  }),
  idleIcon: css({
    fontSize: "3rem",
    display: "block",
    marginBottom: "1rem"
  }),
  idleTitle: css({
    fontSize: "1.1rem",
    fontWeight: 600,
    color: tk.fg,
    margin: "0 0 .5rem"
  }),
  idleText: css({
    fontSize: ".85rem",
    maxWidth: "28rem",
    margin: "0 auto",
    lineHeight: 1.6
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function StatusBadge(handle: Handle<{ active: boolean }>) {
  return () => {
    const active = handle.props.active
    return (
      <span mix={[s.statusBadge, active ? s.badgeActive : s.badgeStale]}>
        <span mix={s.statusDot} style={{ background: active ? "#22c55e" : tk.dimmedFg }} />
        {active ? "Active" : "Stale"}
      </span>
    )
  }
}

function NodeCard(handle: Handle<{ node: OverviewSnapshot["nodes"][number]; nowMs: number }>) {
  return () => {
    const { node, nowMs } = handle.props
    const isActive = node.status === "healthy"

    return (
      <div mix={[s.nodeCard, !isActive ? s.nodeCardStale : undefined]}>
        <div mix={s.nodeHeader}>
          <span mix={s.nodeAddr}>{node.id}</span>
          <StatusBadge active={isActive} />
        </div>
        <div mix={s.nodeMeta}>
          {isActive && (
            <>
              <span mix={s.metaLabel}>Assigned shards</span>
              <span mix={s.metaValue}>{node.assignedShards}</span>
            </>
          )}
          {!isActive && (
            <>
              <span mix={s.metaLabel}>Last seen</span>
              <span mix={s.metaValue}>{fmtRelative(node.lastHeartbeat, nowMs)}</span>
            </>
          )}
          <span mix={s.metaLabel}>Groups</span>
          <span mix={s.metaValue}>{node.groups}</span>
          {isActive && (
            <>
              <span mix={s.metaLabel}>Heartbeat</span>
              <span mix={s.metaValue}>{fmtRelative(node.lastHeartbeat, nowMs)}</span>
            </>
          )}
        </div>
      </div>
    )
  }
}

function ClusterConfigPanel(handle: Handle<{ cluster: OverviewSnapshot["cluster"] }>) {
  return () => {
    const { cluster } = handle.props
    return (
      <div mix={s.configPanel}>
        <div mix={s.configTitle}>Cluster Configuration</div>
        <div mix={s.configGrid}>
          <span mix={s.configLabel}>Storage Backend</span>
          <span mix={s.configValue}>Postgres</span>
          <span mix={s.configLabel}>Total Shards</span>
          <span mix={s.configValue}>{cluster.shardsTotal}</span>
          <span mix={s.configLabel}>Shard lock expiry</span>
          <span mix={s.configValue}>35s</span>
          <span mix={s.configLabel}>Registered nodes</span>
          <span mix={s.configValue}>{cluster.nodesTotal}</span>
        </div>
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// Client entry
// ---------------------------------------------------------------------------

export const NodesEntry: EntryComponent<NodesEntryProps> = clientEntry(
  import.meta.url,
  function NodesEntry(handle: Handle<NodesEntryProps>) {
    const snapshot: OverviewSnapshot = handle.props.initialSnapshot
    const { nowMs } = handle.props

    return () => {
      const { cluster, nodes } = snapshot
      const activeNodes = nodes.filter((n) => n.status === "healthy")
      const hasNodes = nodes.length > 0

      return (
        <main mix={s.container}>
          {/* Title */}
          <div mix={s.headerRow}>
            <div>
              <h1 mix={s.h1}>Cluster Nodes</h1>
              <p mix={s.muted}>
                {activeNodes.length} active / {nodes.length} total runner{hasNodes ? "s" : ""}
              </p>
            </div>
          </div>

          {/* ── IDLE / NO NODES ── */}
          {!hasNodes && (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>⚡</span>
              <h2 mix={s.idleTitle}>No runners registered</h2>
              <p mix={s.idleText}>
                No cluster runners found. Ensure your Effect cluster is running and connected to this database.
              </p>
            </div>
          )}

          {hasNodes && activeNodes.length === 0 && (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>💤</span>
              <h2 mix={s.idleTitle}>All runners stale</h2>
              <p mix={s.idleText}>
                {nodes.length} runner{nodes.length > 1 ? "s" : ""}{" "}
                registered but none have sent a heartbeat within the lock expiration window (35s).
              </p>
            </div>
          )}

          {/* ── Node cards ── */}
          {hasNodes && (
            <div mix={s.nodeGrid}>
              {nodes.map((node) => <NodeCard key={node.id} node={node} nowMs={nowMs} />)}
            </div>
          )}

          {/* ── Config panel ── */}
          {hasNodes && <ClusterConfigPanel cluster={cluster} />}
        </main>
      )
    }
  }
)
