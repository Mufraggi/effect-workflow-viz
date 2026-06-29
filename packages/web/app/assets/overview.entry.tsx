import { clientEntry, css, type EntryComponent, type Handle, type SerializableProps } from "remix/ui"
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
  // Server render time; threaded into relative-time formatting so SSR and
  // hydration produce identical text. See `fmtRelative` in utils/runs.ts.
  nowMs: number
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

// Connection state → topbar live-indicator presentation.
const TOPBAR_STATE = {
  connecting: { color: "#eab308", label: "Connecting", anim: true },
  live: { color: "#22c55e", label: "Live", anim: false },
  reconnecting: { color: "#f97316", label: "Reconnecting", anim: true }
} as const

const fmtClock = (): string =>
  new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })

// Push the live SSE connection state into the global Topbar (server-rendered,
// outside this entry's managed subtree) by updating its nodes by id.
const syncTopbar = (state: ConnectionState) => {
  if (typeof document === "undefined") return
  const { anim, color, label } = TOPBAR_STATE[state]
  const dot = document.getElementById("topbar-live-dot")
  const labelEl = document.getElementById("topbar-live-label")
  const timeEl = document.getElementById("topbar-live-time")
  if (dot) {
    dot.style.background = color
    dot.style.animation = anim ? "pulse 1.5s ease-in-out infinite" : "none"
  }
  if (labelEl) {
    labelEl.textContent = label
    labelEl.style.color = color
  }
  if (timeEl) timeEl.textContent = state === "live" ? `Updated ${fmtClock()}` : ""
}

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
        syncTopbar(connState)
        handle.update()
      }

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as OverviewSnapshot
          snapshot = data
          connState = "live"
          reconnectAttempts = 0
          syncTopbar(connState)
          handle.update()
        } catch {
          // Ignore malformed messages
        }
      }

      es.onerror = () => {
        es?.close()
        es = null
        connState = "reconnecting"
        syncTopbar(connState)
        handle.update()
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(1000 * 2 ** reconnectAttempts, 30000)
          reconnectAttempts++
          reconnectTimer = setTimeout(connect, delay)
        }
      }
    }

    // Connect on client side only (EventSource is not available during SSR)
    if (typeof EventSource !== "undefined") {
      syncTopbar(connState)
      connect()
    }

    // Cleanup on unmount
    handle.signal.addEventListener("abort", cleanup)

    // Helper to connect if disconnected (called on click)
    const manualReconnect = () => {
      if (es === null || es.readyState === EventSource.CLOSED) {
        reconnectAttempts = 0
        connState = "connecting"
        syncTopbar(connState)
        handle.update()
        connect()
      }
    }

    // Clicking the topbar live indicator forces a reconnect attempt.
    if (typeof document !== "undefined") {
      const liveEl = document.getElementById("topbar-live")
      if (liveEl) {
        liveEl.style.cursor = "pointer"
        liveEl.addEventListener("click", manualReconnect)
        handle.signal.addEventListener("abort", () => liveEl.removeEventListener("click", manualReconnect))
      }
    }

    const isClusterIdle = (): boolean => {
      return snapshot.cluster.nodesUp === 0 && snapshot.cluster.shardsAssigned === 0
    }

    return () => {
      const { activity, cluster, nodes, shards, workflows } = snapshot
      const clusterIdle = isClusterIdle()

      return (
        <main mix={s.container}>
          {/* Title (live status now lives in the Topbar) */}
          <div mix={s.headerRow}>
            <h1 mix={s.h1}>Cluster Overview</h1>
            <p mix={s.muted}>
              Monitor your Effect Cluster health, entities, and workflows.
            </p>
          </div>

          {/* ── IDLE STATE ── */}
          {clusterIdle && (
            <div mix={s.idle}>
              <span mix={s.idleIcon}>💤</span>
              <h2 mix={s.idleTitle}>Cluster Idle</h2>
              <p mix={s.idleText}>
                No active runners detected. The cluster has {cluster.nodesTotal}{" "}
                registered runner{nodes.length > 1 ? "s" : ""} but no heartbeat within the lock expiration window (35s).
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
                : cluster.nodesUp >= Math.max(cluster.nodesTotal / 2, 1)
                ? "amber"
                : cluster.nodesTotal > 0
                ? "red"
                : "neutral"}
            />
            <KpiCard
              title="Entities Seen"
              value={fmtNum(cluster.entitiesTotal)}
              sub="workflow types observed"
              accent="neutral"
            />
            <KpiCard
              title="Shards"
              value={`${cluster.shardsAssigned}/${cluster.shardsTotal}`}
              sub={`${cluster.shardsTotal - cluster.shardsAssigned} unassigned`}
              accent={cluster.shardsAssigned === cluster.shardsTotal && cluster.shardsTotal > 0
                ? "green"
                : cluster.shardsAssigned > 0
                ? "amber"
                : "neutral"}
            />
            <KpiCard
              title="Rebalancing"
              value="—"
              sub="not tracked by storage"
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
            <NodesPanel nodes={nodes} nowMs={handle.props.nowMs} />
            <ShardGrid shards={shards} />
          </div>
        </main>
      )
    }
  }
)
