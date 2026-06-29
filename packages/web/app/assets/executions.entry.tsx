import { clientEntry, css, type EntryComponent, type Handle, type SerializableProps } from "remix/ui"
import { routes } from "../routes.js"
import { tk } from "../ui/tokens.js"
import { fmtRelative } from "../utils/runs.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

// A `type` alias (not `interface`) so it carries an implicit index signature
// and satisfies `SerializableObject` inside `SerializableProps`.
export type ExecutionRow = {
  id: string
  workflowName: string
  runId: string
  status: string
  startedAt: string | null
  durationMs: number | null
}

export interface ExecutionsEntryProps extends SerializableProps {
  executions: Array<ExecutionRow>
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
  statusLegend: css({
    display: "flex",
    gap: "1.5rem",
    margin: "1rem 0 1.25rem",
    fontSize: ".72rem",
    color: tk.mutedFg
  }),
  legendItem: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem"
  }),
  legendDot: css({
    width: ".45rem",
    height: ".45rem",
    borderRadius: "50%",
    flexShrink: 0
  }),
  table: css({
    width: "100%",
    borderCollapse: "separate",
    borderSpacing: 0,
    fontSize: ".82rem"
  }),
  th: css({
    textAlign: "left",
    padding: ".6rem .75rem",
    fontSize: ".68rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    borderBottom: `1px solid ${tk.border}`,
    whiteSpace: "nowrap"
  }),
  td: css({
    padding: ".55rem .75rem",
    borderBottom: `1px solid ${tk.borderLight}`,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }),
  row: css({
    transition: "background 0.1s",
    "&:hover": { background: tk.hoverBg }
  }),
  idCell: css({
    maxWidth: "10rem"
  }),
  wfLink: css({
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  badge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".3rem",
    padding: ".15rem .5rem",
    borderRadius: "999px",
    fontSize: ".7rem",
    fontWeight: 600,
    fontFamily: tk.fontMono
  }),
  badgeSuccess: css({
    color: "#22c55e",
    background: "rgba(34,197,94,0.12)"
  }),
  badgeRunning: css({
    color: "#3b82f6",
    background: "rgba(59,130,246,0.12)"
  }),
  badgePending: css({
    color: "#eab308",
    background: "rgba(234,179,8,0.12)"
  }),
  badgeFailed: css({
    color: "#ef4444",
    background: "rgba(239,68,68,0.12)"
  }),
  wfName: css({
    color: tk.fg,
    fontWeight: 500,
    maxWidth: "18rem",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }),
  mono: css({
    fontFamily: tk.fontMono,
    fontSize: ".75rem",
    color: tk.dimmedFg
  }),
  durValue: css({
    fontFamily: tk.fontMono,
    color: tk.mutedFg,
    fontSize: ".75rem"
  }),
  empty: css({
    textAlign: "center",
    padding: "4rem 2rem",
    color: tk.mutedFg
  }),
  emptyIcon: css({
    fontSize: "3rem",
    display: "block",
    marginBottom: "1rem"
  }),
  emptyTitle: css({
    fontSize: "1.1rem",
    fontWeight: 600,
    color: tk.fg,
    margin: "0 0 .5rem"
  }),
  emptyText: css({
    fontSize: ".85rem",
    maxWidth: "24rem",
    margin: "0 auto",
    lineHeight: 1.6
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<string, typeof s.badgeSuccess> = {
  pending: s.badgePending,
  running: s.badgeRunning,
  success: s.badgeSuccess,
  failed_app: s.badgeFailed,
  crashed: s.badgeFailed,
  interrupted: s.badgeFailed,
  unknown: s.badgeFailed
}

const DISPLAY_STATUS: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  failed_app: "Failed",
  crashed: "Failed",
  interrupted: "Failed",
  unknown: "Failed"
}

const formatDuration = (
  status: string,
  durationMs: number | null,
  startedAt: string | null,
  nowMs: number
): string => {
  if (status === "pending") return "—"
  if (status === "running") {
    if (!startedAt) return "—"
    const elapsed = nowMs - new Date(startedAt).getTime()
    if (Number.isNaN(elapsed) || elapsed < 0) return "—"
    if (elapsed < 1000) return "<1s"
    if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s`
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ${Math.floor((elapsed % 60_000) / 1000)}s`
    return `${Math.floor(elapsed / 3_600_000)}h ${Math.floor((elapsed % 3_600_000) / 60_000)}m`
  }
  if (durationMs === null || durationMs <= 0) return "—"
  if (durationMs < 1000) return `${durationMs}ms`
  if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)}s`
  if (durationMs < 3_600_000) return `${Math.floor(durationMs / 60_000)}m ${Math.floor((durationMs % 60_000) / 1000)}s`
  return `${Math.floor(durationMs / 3_600_000)}h ${Math.floor((durationMs % 3_600_000) / 60_000)}m`
}

const stripPrefix = (name: string): string => name.startsWith("Workflow/") ? name.slice("Workflow/".length) : name

const truncateId = (id: string): string => id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id

// ---------------------------------------------------------------------------
// Client entry
// ---------------------------------------------------------------------------

export const ExecutionsEntry: EntryComponent<ExecutionsEntryProps> = clientEntry(
  import.meta.url,
  function ExecutionsEntry(handle: Handle<ExecutionsEntryProps>) {
    const { executions, nowMs } = handle.props

    return () => {
      if (executions.length === 0) {
        return (
          <main mix={s.container}>
            <div mix={s.headerRow}>
              <div>
                <h1 mix={s.h1}>Workflow Executions</h1>
                <p mix={s.muted}>No workflow executions found.</p>
              </div>
            </div>
            <div mix={s.empty}>
              <span mix={s.emptyIcon}>📭</span>
              <h2 mix={s.emptyTitle}>No executions yet</h2>
              <p mix={s.emptyText}>
                Workflows will appear here once they are executed.
              </p>
            </div>
          </main>
        )
      }

      const counts = {
        running: executions.filter((e) => e.status === "running").length,
        success: executions.filter((e) => e.status === "success").length,
        failed: executions.filter((e) => ["failed_app", "crashed", "interrupted", "unknown"].includes(e.status)).length,
        pending: executions.filter((e) => e.status === "pending").length
      }

      return (
        <main mix={s.container}>
          {/* Title */}
          <div mix={s.headerRow}>
            <div>
              <h1 mix={s.h1}>Workflow Executions</h1>
              <p mix={s.muted}>
                {executions.length} execution{executions.length > 1 ? "s" : ""} found
              </p>
            </div>
          </div>

          {/* Status legend with counts */}
          <div mix={s.statusLegend}>
            <div mix={s.legendItem}>
              <span mix={s.legendDot} style={{ background: "#22c55e" }} />
              {counts.success} success
            </div>
            <div mix={s.legendItem}>
              <span mix={s.legendDot} style={{ background: "#ef4444" }} />
              {counts.failed} failed
            </div>
            <div mix={s.legendItem}>
              <span mix={s.legendDot} style={{ background: "#3b82f6" }} />
              {counts.running} running
            </div>
            <div mix={s.legendItem}>
              <span mix={s.legendDot} style={{ background: "#eab308" }} />
              {counts.pending} pending
            </div>
          </div>

          {/* Table */}
          <table mix={s.table}>
            <thead>
              <tr>
                <th mix={s.th}>Workflow</th>
                <th mix={s.th}>Execution ID</th>
                <th mix={s.th}>Status</th>
                <th mix={s.th}>Started</th>
                <th mix={s.th}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((ex) => (
                <tr key={ex.id} mix={s.row}>
                  <td mix={[s.td, s.wfName]} title={stripPrefix(ex.workflowName)}>
                    <a mix={s.wfLink} href={routes.executionShow.href({ executionId: ex.runId })}>
                      {stripPrefix(ex.workflowName)}
                    </a>
                  </td>
                  <td mix={[s.td, s.mono, s.idCell]} title={ex.runId}>
                    {truncateId(ex.runId)}
                  </td>
                  <td mix={s.td}>
                    <span mix={[s.badge, STATUS_BADGE[ex.status] || s.badgePending]}>
                      {DISPLAY_STATUS[ex.status] || "Pending"}
                    </span>
                  </td>
                  <td mix={[s.td, s.mono]}>
                    {fmtRelative(ex.startedAt, nowMs)}
                  </td>
                  <td mix={[s.td, s.durValue]}>
                    {formatDuration(ex.status, ex.durationMs, ex.startedAt, nowMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )
    }
  }
)
