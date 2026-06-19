import { type Handle } from "remix/ui"
import type { ActivityPoint } from "../../types/overview.js"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Pure SVG line chart — zero dependencies, dark theme.
// ---------------------------------------------------------------------------

const WIDTH = 800
const HEIGHT = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 40 }
const PLOT_W = WIDTH - PAD.left - PAD.right
const PLOT_H = HEIGHT - PAD.top - PAD.bottom

const formatHour = (epochMs: number): string => {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

const buildLinePath = (
  data: ReadonlyArray<ActivityPoint>,
  getY: (p: ActivityPoint) => number,
  scaleY: (v: number) => number,
  stepX: number
): string =>
  data
    .map((p, i) => {
      const x = PAD.left + i * stepX
      return `${i === 0 ? "M" : "L"}${x},${scaleY(getY(p))}`
    })
    .join(" ")

const buildAreaPath = (
  data: ReadonlyArray<ActivityPoint>,
  getY: (p: ActivityPoint) => number,
  scaleY: (v: number) => number,
  stepX: number,
  baseY: number
): string => {
  if (data.length === 0) return ""
  const pts = data.map((p, i) => `${PAD.left + i * stepX},${scaleY(getY(p))}`)
  const lastX = PAD.left + (data.length - 1) * stepX
  return `M${pts[0]} L${pts.slice(1).join(" L")} L${lastX},${baseY} Z`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityChart(handle: Handle<{ data: ReadonlyArray<ActivityPoint> }>) {
  return () => {
    const { data } = handle.props
    if (data.length < 2) {
      return (
        <div style={{ color: tk.mutedFg, fontSize: ".82rem", padding: "2rem", textAlign: "center" }}>
          Not enough data points yet.
        </div>
      )
    }

    const maxCompleted = Math.max(...data.map((p) => p.completed), 1)
    const maxFailed = Math.max(...data.map((p) => p.failed), 1)
    const yMax = Math.max(maxCompleted, maxFailed) * 1.15

    const scaleY = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H
    const baseY = PAD.top + PLOT_H
    const stepX = PLOT_W / Math.max(data.length - 1, 1)

    // Pre-compute SVG paths
    const completedLine = buildLinePath(data, (p) => p.completed, scaleY, stepX)
    const failedLine = buildLinePath(data, (p) => p.failed, scaleY, stepX)
    const completedArea = buildAreaPath(data, (p) => p.completed, scaleY, stepX, baseY)
    const failedArea = buildAreaPath(data, (p) => p.failed, scaleY, stepX, baseY)

    // Y-axis ticks
    const ticks: Array<number> = []
    const tickCount = 4
    for (let i = 0; i <= tickCount; i++) {
      ticks.push(Math.round((yMax / tickCount) * i))
    }

    // X-axis labels (every ~4h)
    const labelInterval = Math.max(1, Math.floor(data.length / 7))
    const xLabels = data.filter((_, i) => i % labelInterval === 0 || i === data.length - 1)

    return (
      <div
        style={{
          background: tk.card,
          border: `1px solid ${tk.border}`,
          borderRadius: tk.radius,
          padding: "1rem 1.25rem"
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: ".75rem"
          }}
        >
          <span style={{ fontSize: ".82rem", fontWeight: 600, color: tk.fg }}>
            Workflow Activity (last 24h)
          </span>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <Legend color="#22c55e" label="Completed" />
            <Legend color="#ef4444" label="Failed" />
          </div>
        </div>

        {/* SVG chart */}
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          role="img"
          aria-label="Workflow activity chart"
        >
          {/* Grid lines + Y labels */}
          {ticks.map((t) => {
            const y = scaleY(t)
            return (
              <g key={t}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={WIDTH - PAD.right}
                  y2={y}
                  stroke={tk.borderLight}
                  strokeWidth="1"
                />
                <text
                  x={PAD.left - 6}
                  y={y + 3.5}
                  textAnchor="end"
                  fill={tk.dimmedFg}
                  fontSize="10"
                  fontFamily={tk.fontMono}
                >
                  {t}
                </text>
              </g>
            )
          })}

          {/* X-axis labels */}
          {xLabels.map((p, idx) => {
            const i = data.indexOf(p)
            const x = PAD.left + i * stepX
            return (
              <text
                key={idx}
                x={x}
                y={HEIGHT - 6}
                textAnchor="middle"
                fill={tk.dimmedFg}
                fontSize="9"
                fontFamily={tk.fontMono}
              >
                {formatHour(p.t)}
              </text>
            )
          })}

          {/* Failed area */}
          {failedArea && <path d={failedArea} fill="rgba(239,68,68,0.08)" />}

          {/* Completed area */}
          {completedArea && <path d={completedArea} fill="rgba(34,197,94,0.06)" />}

          {/* Failed line */}
          <path
            d={failedLine}
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Completed line */}
          <path
            d={completedLine}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Legend(handle: Handle<{ color: string; label: string }>) {
  return () => (
    <div style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
      <span
        style={{
          width: ".55rem",
          height: ".55rem",
          borderRadius: "50%",
          background: handle.props.color,
          flexShrink: 0
        }}
      />
      <span style={{ fontSize: ".72rem", color: tk.mutedFg }}>{handle.props.label}</span>
    </div>
  )
}
