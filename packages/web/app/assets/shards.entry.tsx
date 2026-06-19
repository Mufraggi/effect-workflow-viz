import { clientEntry, css, type EntryComponent, type Handle, type SerializableProps } from "remix/ui"
import { KpiCard } from "../components/overview/KpiCard.js"
import { NodesPanel } from "../components/overview/NodesPanel.js"
import { SectionHeader } from "../components/overview/SectionHeader.js"
import { ShardGrid } from "../components/overview/ShardGrid.js"
import type { OverviewSnapshot } from "../types/overview.js"
import { tk } from "../ui/tokens.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ShardsEntryProps extends SerializableProps {
  initialSnapshot: OverviewSnapshot
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
    marginBottom: ".25rem"
  }),
  h1: css({
    margin: "0 0 .25rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  muted: css({ color: tk.mutedFg, fontSize: ".85rem", margin: 0 }),
  kpiRow: css({
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: ".75rem",
    marginBottom: ".5rem"
  }),
  bottomRow: css({
    display: "flex",
    gap: ".75rem",
    marginTop: "1rem"
  }),
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
// Number formatting
// ---------------------------------------------------------------------------

const fmtNum = (n: number): string => n.toLocaleString("en-US")

// ---------------------------------------------------------------------------
// Client entry: dedicated Shards page (no SSE, data loaded server-side)
// ---------------------------------------------------------------------------

export const ShardsEntry: EntryComponent<ShardsEntryProps> = clientEntry(
  import.meta.url,
  function ShardsEntry(handle: Handle<ShardsEntryProps>) {
    const snapshot: OverviewSnapshot = handle.props.initialSnapshot

    return () => {
      const { cluster, nodes, shards } = snapshot
      const clusterIdle = cluster.nodesUp === 0 && cluster.shardsAssigned === 0

      return (
        <main mix={s.container}>
          {/* Title */}
          <div mix={s.headerRow}>
            <div>
              <h1 mix={s.h1}>Shard Distribution</h1>
              <p mix={s.muted}>
                Live shard-to-runner assignment across {cluster.nodesTotal} node{cluster.nodesTotal > 1 ? "s" : ""}.
              </p>
            </div>
          </div>

          {/* ── IDLE STATE ── */}
          {clusterIdle && (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>💤</span>
              <h2 mix={s.idleTitle}>Cluster Idle</h2>
              <p mix={s.idleText}>
                No active shards assigned. {cluster.nodesTotal > 0
                  ? `${cluster.nodesUp}/${cluster.nodesTotal} nodes are active.`
                  : "No runners registered."}
              </p>
            </div>
          )}

          {/* ── CLUSTER KPIs ── */}
          <SectionHeader label="Cluster" />
          <div mix={s.kpiRow}>
            <KpiCard
              title="Nodes"
              value={`${cluster.nodesUp}/${cluster.nodesTotal}`}
              sub={cluster.nodesTotal > 0
                ? `${cluster.nodesTotal - cluster.nodesUp} offline`
                : "no runners"}
              accent={cluster.nodesUp === cluster.nodesTotal && cluster.nodesTotal > 0
                ? "green"
                : cluster.nodesTotal > 0
                ? cluster.nodesUp >= Math.max(cluster.nodesTotal / 2, 1)
                  ? "amber"
                  : "red"
                : "neutral"}
            />
            <KpiCard
              title="Shards Assigned"
              value={`${cluster.shardsAssigned}/${cluster.shardsTotal}`}
              sub={`${cluster.shardsTotal - cluster.shardsAssigned} unassigned`}
              accent={cluster.shardsAssigned === cluster.shardsTotal && cluster.shardsTotal > 0
                ? "green"
                : cluster.shardsAssigned > 0
                ? "amber"
                : "neutral"}
            />
            <KpiCard
              title="Entities Seen"
              value={fmtNum(cluster.entitiesTotal)}
              sub="workflow types observed"
              accent="neutral"
            />
            <KpiCard
              title="Rebalancing"
              value="—"
              sub="not tracked by storage"
              accent="neutral"
            />
          </div>

          {/* ── Nodes + Shards side-by-side ── */}
          <div mix={s.bottomRow}>
            <NodesPanel nodes={nodes} />
            <ShardGrid shards={shards} />
          </div>
        </main>
      )
    }
  }
)
