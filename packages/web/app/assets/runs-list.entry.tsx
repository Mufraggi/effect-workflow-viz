import { clientEntry, css, type EntryComponent, type Handle, on, type SerializableProps } from "remix/ui"
import { routes } from "../routes.js"
import { STATUS_COLOR, tk } from "../ui/tokens.js"
import { fmtDate, fmtDuration, type RunSummaryEncoded } from "../utils/runs.js"

interface RunsListProps extends SerializableProps {
  runs: Array<RunSummaryEncoded>
  nextCursor: string | null
  // Active filter query string (no leading "?", no cursor) used to fetch more.
  query: string
}

interface RunsPage {
  items: Array<RunSummaryEncoded>
  nextCursor: string | null
}

const LIVE_POLL_MS = 5000

const t = {
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    overflow: "hidden",
    marginTop: "1.5rem"
  }),
  table: css({ width: "100%", borderCollapse: "collapse", fontSize: ".875rem" }),
  th: css({
    textAlign: "left",
    padding: ".7rem 1rem",
    borderBottom: `1px solid ${tk.border}`,
    fontWeight: 600,
    color: tk.mutedFg,
    fontSize: ".7rem",
    textTransform: "uppercase",
    letterSpacing: ".05em"
  }),
  td: css({ padding: ".7rem 1rem", borderBottom: `1px solid ${tk.border}` }),
  mono: css({ fontFamily: tk.fontMono, fontSize: ".78rem", wordBreak: "break-all" }),
  link: css({ color: tk.primary, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }),
  muted: css({ color: tk.mutedFg, fontSize: ".9rem" }),
  button: css({
    marginTop: "1rem",
    padding: ".5rem 1rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.card,
    color: "inherit",
    font: "inherit",
    fontSize: ".85rem",
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { background: tk.hoverBg },
    "&:disabled": { opacity: 0.5, cursor: "default" }
  }),
  toolbar: css({ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }),
  live: css({
    padding: ".4rem .85rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.card,
    color: "inherit",
    font: "inherit",
    fontSize: ".8rem",
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { background: tk.hoverBg }
  }),
  liveOn: css({ borderColor: "#15803d", color: "#15803d", background: "#15803d14" })
}

const badge = (status: string) => {
  const c = STATUS_COLOR[status] ?? "#71717a"
  return css({
    display: "inline-block",
    padding: ".15rem .6rem",
    borderRadius: "999px",
    fontSize: ".72rem",
    fontWeight: 500,
    fontFamily: tk.fontMono,
    color: c,
    background: `${c}1f`
  })
}

// Interactive, accumulative runs table. Server-rendered for the first page,
// then hydrated on the client: "Load more" fetches the JSON `/runs` endpoint
// and APPENDS rows in place (no full navigation).
export const RunsList: EntryComponent<RunsListProps> = clientEntry(
  import.meta.url,
  function RunsList(handle: Handle<RunsListProps>) {
    let runs: Array<RunSummaryEncoded> = [...handle.props.runs]
    let cursor: string | null = handle.props.nextCursor
    let loading = false
    let live = false
    let timer: ReturnType<typeof setInterval> | null = null

    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    // Stop polling when the component disconnects (navigation away / teardown).
    handle.signal.addEventListener("abort", stopTimer)

    // Poll the newest page with the active filters and PREPEND any runs we
    // haven't seen yet — new runs have larger ids, so they sort to the front.
    const refresh = async () => {
      try {
        const res = await fetch(`${routes.runs.href()}?${handle.props.query}`, {
          headers: { accept: "application/json" }
        })
        if (!res.ok) return
        const data = (await res.json()) as RunsPage
        const seen = new Set(runs.map((r) => r.id))
        const fresh = data.items.filter((r) => !seen.has(r.id))
        if (fresh.length === 0) return
        runs = [...fresh, ...runs]
        handle.update()
      } catch {
        // Transient network error — the next tick retries.
      }
    }

    const toggleLive = () => {
      live = !live
      stopTimer()
      if (live) {
        timer = setInterval(refresh, LIVE_POLL_MS)
        void refresh()
      }
      handle.update()
    }

    // `signal` aborts when the handler is re-entered or the component is removed,
    // so an in-flight "Load more" can't append stale rows after teardown.
    const loadMore = async (signal: AbortSignal) => {
      if (cursor === null || loading) return
      loading = true
      handle.update()
      try {
        const sep = handle.props.query.length > 0 ? "&" : ""
        const url = `${routes.runs.href()}?${handle.props.query}${sep}before=${encodeURIComponent(cursor)}`
        const res = await fetch(url, { headers: { accept: "application/json" }, signal })
        const data = (await res.json()) as RunsPage
        if (signal.aborted) return
        runs = [...runs, ...data.items]
        cursor = data.nextCursor
      } finally {
        if (!signal.aborted) {
          loading = false
          handle.update()
        }
      }
    }

    const liveButton = () => (
      <div mix={t.toolbar}>
        <button type="button" mix={[t.live, ...(live ? [t.liveOn] : []), on("click", () => toggleLive())]}>
          {live ? "● Live" : "○ Live"}
        </button>
      </div>
    )

    return () => {
      if (runs.length === 0) {
        return (
          <div>
            {liveButton()}
            <p mix={t.muted}>No runs found.</p>
          </div>
        )
      }
      return (
        <div>
          {liveButton()}
          <div mix={t.card}>
            <table mix={t.table}>
              <thead>
                <tr>
                  <th mix={t.th}>Workflow</th>
                  <th mix={t.th}>Status</th>
                  <th mix={t.th}>Run ID</th>
                  <th mix={t.th}>Trace ID</th>
                  <th mix={t.th}>Started</th>
                  <th mix={t.th}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td mix={t.td}>
                      <a mix={t.link} href={routes.runShow.href({ messageId: run.id })}>{run.workflowName}</a>
                    </td>
                    <td mix={t.td}>
                      <span mix={badge(run.status)}>{run.status}</span>
                    </td>
                    <td mix={[t.td, t.mono]}>{run.runId}</td>
                    <td mix={[t.td, t.mono]}>{run.traceId ?? "—"}</td>
                    <td mix={t.td}>{fmtDate(run.startedAt)}</td>
                    <td mix={[t.td, t.mono]}>{fmtDuration(run.durationMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cursor !== null && (
            <p>
              <button
                type="button"
                mix={[t.button, on("click", (_event, signal) => loadMore(signal))]}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </p>
          )}
        </div>
      )
    }
  }
)
