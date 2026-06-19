import { clientEntry, css, type EntryComponent, type Handle, on, type SerializableProps } from "remix/ui"
import { ActivityChart } from "../components/overview/ActivityChart.js"
import { KpiCard } from "../components/overview/KpiCard.js"
import { NodesPanel } from "../components/overview/NodesPanel.js"
import { SectionHeader } from "../components/overview/SectionHeader.js"
import { ShardGrid } from "../components/overview/ShardGrid.js"
import type { OverviewSnapshot } from "../types/overview.js"
import { tk } from "../ui/tokens.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OverviewEntryProps extends SerializableProps {
  initialSnapshot: OverviewSnapshot
}

type ConnectionState = "connecting" | "live" | "reconnecting"

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
  statusBadge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".25rem .65rem",
    borderRadius: "999px",
    fontSize: ".72rem",
    fontWeight: 600,
    fontFamily: tk.fontMono,
    flexShrink: 0
  }),
  badgeLive: css({
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)"
  }),
  badgeConnecting: css({
    color: "#eab308",
    background: "rgba(234,179,8,0.12)"
  }),
  badgeReconnecting: css({
    color: "#f97316",
    background: "rgba(249,115,22,0.12)"
  }),
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
  noData: css({
    textAlign: "center",
    padding: "4rem 2rem",
    color: tk.mutedFg
  })
}

const STATUS_DOT = {
  connecting: { bg: "#eab308", anim: true },
  live: { bg: "#22c55e", anim: false },
  reconnecting: { bg: "#f97316", anim: true }
} as const

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

const fmtNum = (n: number): string => n.toLocaleString("en-US")
const fmtDelta = (pct: number): number | null => (Math.abs(pct) > 0.1 ? Math.round(pct * 10) / 10 : null)

// ---------------------------------------------------------------------------
// Client entry: Overview with SSE live streaming
// ---------------------------------------------------------------------------

export const OverviewEntry: EntryComponent<OverviewEntryProps> = clientEntry(
  import.meta.url,
  function OverviewEntry(handle: Handle<OverviewEntryProps>) {
    let snapshot: OverviewSnapshot = handle.props.initialSnapshot
    let connState: ConnectionState = "connecting"
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let reconnectAttempts = 0
    const MAX_RECONNECT_ATTEMPTS = 20

    const cleanup = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (es !== null) {
        es.close()
        es = null
      }
    }

    const connect = () => {
      cleanup()

      es = new EventSource("/overview/stream")

      es.onopen = () => {
        connState = "live"
        reconnectAttempts = 0
        handle.update()
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as OverviewSnapshot
          snapshot = data
          connState = "live"
          reconnectAttempts = 0
          handle.update()
        } catch {
          // Ignore malformed messages
        }
      }

      es.onerror = () => {
        es?.close()
        es = null
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          connState = "reconnecting"
          handle.update()
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
          reconnectAttempts++
          reconnectTimer = setTimeout(connect, delay)
        } else {
          connState = "reconnecting"
          handle.update()
        }
      }
    }

    // Connect on client side only (EventSource is not available during SSR)
    if (typeof EventSource !== "undefined") {
      connect()
    }

    // Cleanup on unmount
    handle.signal.addEventListener("abort", cleanup)

    // Helper to connect if disconnected (called on click)
    const manualReconnect = () => {
      if (es === null || es.readyState === EventSource.CLOSED) {
        reconnectAttempts = 0
        connState = "connecting"
        handle.update()
        connect()
      }
    }

    return () => {
      const { activity, cluster, nodes, shards, workflows } = snapshot
      const dot = STATUS_DOT[connState]
      const badgeClass = connState === "live"
        ? s.badgeLive
        : connState === "connecting"
        ? s.badgeConnecting
        : s.badgeReconnecting

      const badgeLabel = connState === "live"
        ? "● Live"
        : connState === "connecting"
        ? "○ Connecting"
        : "⚠ Reconnecting"

      return (
        <main mix={s.container}>
          {/* Title + status */}
          <div mix={s.headerRow}>
            <div>
              <h1 mix={s.h1}>Cluster Overview</h1>
              <p mix={s.muted}>
                Monitor your Effect Cluster health, entities, and workflows.
              </p>
            </div>
            <div
              mix={[s.statusBadge, badgeClass, on("click", manualReconnect)]}
              style={{ cursor: connState !== "live" ? "pointer" : undefined }}
              role="status"
              aria-live="polite"
            >
              {dot.anim && (
                <span
                  style={{
                    width: ".35rem",
                    height: ".35rem",
                    borderRadius: "50%",
                    background: dot.bg,
                    animation: "pulse 1.5s ease-in-out infinite",
                    flexShrink: 0
                  }}
                />
              )}
              {badgeLabel}
            </div>
          </div>

          {/* ── CLUSTER KPIs ── */}
          <SectionHeader label="Cluster" />
          <div mix={s.kpiRow}>
            <KpiCard
              title="Nodes"
              value={`${cluster.nodesUp}/${cluster.nodesTotal}`}
              sub={`${cluster.nodesTotal - cluster.nodesUp} offline`}
              accent={cluster.nodesUp === cluster.nodesTotal
                ? "green"
                : cluster.nodesUp >= cluster.nodesTotal / 2
                ? "amber"
                : "red"}
            />
            <KpiCard
              title="Entities"
              value={fmtNum(cluster.activeEntities)}
              sub={`of ${fmtNum(cluster.entitiesTotal)} total`}
              accent="neutral"
            />
            <KpiCard
              title="Shards"
              value={`${cluster.shardsAssigned}/${cluster.shardsTotal}`}
              sub={`${cluster.shardsTotal - cluster.shardsAssigned} unassigned`}
              accent={cluster.shardsAssigned === cluster.shardsTotal ? "green" : "amber"}
            />
            <KpiCard
              title="Msg / sec"
              value={fmtNum(cluster.msgPerSec)}
              sub={`${cluster.avgLatencyMs}ms avg latency`}
              delta={fmtDelta(cluster.msgDeltaPct)}
              accent="neutral"
            />
          </div>

          {/* ── WORKFLOWS KPIs ── */}
          <SectionHeader label="Workflows" />
          <div mix={s.kpiRow}>
            <KpiCard
              title="Active"
              value={fmtNum(workflows.active)}
              delta={fmtDelta(workflows.activeDeltaPct)}
              accent="amber"
            />
            <KpiCard
              title="Completed"
              value={fmtNum(workflows.completedToday)}
              sub="today"
              delta={fmtDelta(workflows.completedDeltaPct)}
              accent="green"
            />
            <KpiCard
              title="Failed"
              value={fmtNum(workflows.failedToday)}
              sub="today"
              delta={fmtDelta(workflows.failedDeltaPct)}
              accent="red"
            />
            <KpiCard
              title="Compensating"
              value={fmtNum(workflows.compensating)}
              accent="amber"
            />
          </div>

          {/* ── Activity Chart ── */}
          <div style={{ marginTop: "1.5rem" }}>
            <ActivityChart data={activity} />
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
