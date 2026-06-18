import { Chart, type ChartConfiguration, type ChartDataset } from "chart.js/auto"
import { clientEntry, css, type EntryComponent, type Handle, on, ref, type SerializableProps } from "remix/ui"
import { routes } from "../routes.js"
import { STATUS_COLOR, tk } from "../ui/tokens.js"
import { fmtDate, fmtDuration, type RunSummaryEncoded } from "../utils/runs.js"

interface ScatterProps extends SerializableProps {
  runs: Array<RunSummaryEncoded>
  // Range bounds of the X (time) axis, in ms since the Unix epoch.
  fromMs: number
  toMs: number
  // Active filter query string (no leading "?", no limit) reused for live polls.
  query: string
  // True when the run set was capped server-side (more rows exist than plotted).
  truncated: boolean
}

interface RunsPageJson {
  items: Array<RunSummaryEncoded>
}

// A scatter datum carries the plotted coordinates plus the source run fields the
// tooltip and click handler need (Chart.js preserves the whole object on `raw`).
interface Point {
  x: number
  y: number
  id: string
  workflowName: string
  status: string
  startedAt: string
}

const HEIGHT = 460
const POLL_MS = 5000
const GRID = "rgba(100, 100, 120, 0.12)"

const s = {
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1.25rem 1.5rem 1rem",
    marginTop: "1.5rem"
  }),
  toolbar: css({ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap", marginBottom: ".75rem" }),
  count: css({ fontSize: ".8rem", color: tk.mutedFg }),
  muted: css({ fontSize: ".75rem", color: tk.mutedFg }),
  warn: css({ fontSize: ".75rem", color: "#c2410c" }),
  live: css({
    marginLeft: "auto",
    padding: ".4rem .85rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".8rem",
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { background: tk.hoverBg }
  }),
  liveOn: css({ borderColor: "#15803d", color: "#15803d", background: "#15803d14" }),
  plotArea: css({ position: "relative", width: "100%", height: `${HEIGHT}px` }),
  empty: css({ color: tk.mutedFg, fontSize: ".9rem", padding: "3rem 0", textAlign: "center" })
}

// X-axis tick labels: short UTC time within a day, else month-day + time.
const fmtTick = (ms: number, rangeMs: number): string => {
  const iso = new Date(ms).toISOString()
  return rangeMs <= 86_400_000 ? iso.slice(11, 16) : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`
}

// Group runs that have a measurable duration into one Chart.js dataset per
// status, so the native legend shows status colors and toggles them. Runs with
// no duration (no reply yet) can't sit on a log axis and are surfaced as a count.
const buildDatasets = (rows: Array<RunSummaryEncoded>): Array<ChartDataset<"scatter", Array<Point>>> => {
  const byStatus = new Map<string, Array<Point>>()
  for (const r of rows) {
    if (r.startedAt === null || r.durationMs === null) continue
    const pt: Point = {
      x: Date.parse(r.startedAt),
      y: r.durationMs,
      id: r.id,
      workflowName: r.workflowName,
      status: r.status,
      startedAt: r.startedAt
    }
    const arr = byStatus.get(r.status)
    if (arr === undefined) byStatus.set(r.status, [pt])
    else arr.push(pt)
  }
  const datasets: Array<ChartDataset<"scatter", Array<Point>>> = []
  for (const [status, data] of byStatus) {
    const color = STATUS_COLOR[status] ?? STATUS_COLOR.unknown
    datasets.push({
      label: status,
      data,
      backgroundColor: color,
      borderColor: "#ffffffcc",
      borderWidth: 1,
      pointRadius: 4,
      pointHoverRadius: 6
    })
  }
  return datasets
}

const buildConfig = (
  rows: Array<RunSummaryEncoded>,
  fromMs: number,
  toMs: number
): ChartConfiguration<"scatter", Array<Point>> => ({
  type: "scatter",
  data: { datasets: buildDatasets(rows) },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    onClick: (_event, elements, chart) => {
      const hit = elements[0]
      if (hit === undefined) return
      const point = chart.data.datasets[hit.datasetIndex].data[hit.index] as Point
      window.location.assign(routes.runShow.href({ messageId: point.id }))
    },
    scales: {
      x: {
        type: "linear",
        min: fromMs,
        max: toMs,
        grid: { color: GRID },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          callback: (value) => fmtTick(Number(value), toMs - fromMs)
        }
      },
      y: {
        type: "logarithmic",
        min: 1,
        grid: { color: GRID },
        title: { display: true, text: "duration" },
        ticks: { callback: (value) => fmtDuration(Number(value)) }
      }
    },
    plugins: {
      legend: { position: "top", labels: { usePointStyle: true, boxWidth: 8, font: { size: 11 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const pt = ctx.raw as Point
            return `${pt.workflowName} · ${pt.status} · ${fmtDate(pt.startedAt)} · ${fmtDuration(pt.y)}`
          }
        }
      }
    }
  }
})

// Scatter of runs: X = start time, Y = duration (log scale), color = status,
// rendered with Chart.js. The chart instance is created imperatively on the
// canvas via `ref` and lives in the setup scope; live polling mutates its data
// and calls `chart.update()` rather than re-rendering the canvas through JSX.
export const RunsScatter: EntryComponent<ScatterProps> = clientEntry(
  import.meta.url,
  function RunsScatter(handle: Handle<ScatterProps>) {
    let runs: Array<RunSummaryEncoded> = [...handle.props.runs]
    let toMs = handle.props.toMs
    const fromMs = handle.props.fromMs
    let live = false
    let timer: ReturnType<typeof setInterval> | null = null
    let chart: Chart<"scatter", Array<Point>> | null = null

    const noDurationCount = (): number => runs.filter((r) => r.startedAt !== null && r.durationMs === null).length

    const stopTimer = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    const destroyChart = () => {
      if (chart !== null) {
        chart.destroy()
        chart = null
      }
    }
    // Tie polling + the chart instance to the component lifecycle.
    handle.signal.addEventListener("abort", () => {
      stopTimer()
      destroyChart()
    })

    // Push the current run set onto the existing chart (no animation), extending
    // the time axis to keep freshly-arrived runs in view.
    const applyToChart = () => {
      if (chart === null) return
      chart.data.datasets = buildDatasets(runs)
      const xScale = chart.options.scales?.x
      if (xScale !== undefined) xScale.max = toMs
      chart.update("none")
    }

    // Poll the JSON runs endpoint with the active filters and merge any runs we
    // haven't plotted yet.
    const refresh = async () => {
      try {
        const qs = new URLSearchParams(handle.props.query)
        qs.set("limit", "200")
        const res = await fetch(`${routes.runs.href()}?${qs.toString()}`, { headers: { accept: "application/json" } })
        if (!res.ok) return
        const data = (await res.json()) as RunsPageJson
        const seen = new Set(runs.map((r) => r.id))
        const fresh = data.items.filter((r) => !seen.has(r.id))
        if (fresh.length === 0) return
        runs = [...fresh, ...runs]
        for (const r of fresh) {
          const t = r.startedAt === null ? null : Date.parse(r.startedAt)
          if (t !== null && t + 1 > toMs) toMs = t + 1
        }
        applyToChart()
        handle.update()
      } catch {
        // Transient network error — the next tick retries.
      }
    }

    const toggleLive = () => {
      live = !live
      stopTimer()
      if (live) {
        timer = setInterval(() => void refresh(), POLL_MS)
        void refresh()
      }
      handle.update()
    }

    // Mount Chart.js when the canvas is inserted; the per-element signal aborts
    // when it is removed, so we destroy the instance there (no orphans).
    const mountCanvas = (node: Element, signal: AbortSignal) => {
      destroyChart()
      chart = new Chart(node as HTMLCanvasElement, buildConfig(runs, fromMs, toMs))
      signal.addEventListener("abort", destroyChart)
    }

    return () => {
      const total = runs.length
      const noDur = noDurationCount()
      return (
        <div mix={s.card}>
          <div mix={s.toolbar}>
            <span mix={s.count}>{total} runs</span>
            {noDur > 0 && <span mix={s.muted}>{noDur} sans durée</span>}
            {handle.props.truncated && <span mix={s.warn}>showing newest {total} (range has more)</span>}
            <button
              type="button"
              mix={[s.live, ...(live ? [s.liveOn] : []), on("click", () => toggleLive())]}
            >
              {live ? "● Live" : "○ Live"}
            </button>
          </div>

          {total === 0
            ? <p mix={s.empty}>No runs in this range.</p>
            : (
              <div mix={s.plotArea}>
                <canvas mix={[ref(mountCanvas)]} />
              </div>
            )}
        </div>
      )
    }
  }
)
