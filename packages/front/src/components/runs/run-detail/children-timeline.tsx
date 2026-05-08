import type { RunStatus } from "@template/domain/run/RunStatus"

interface Point {
  t: number
  status: RunStatus
  isParent: boolean
}

const STATUS_COLOR: Record<RunStatus, string> = {
  success: "#10b981",
  running: "#3b82f6",
  pending: "#a1a1aa",
  failed_app: "#ef4444",
  crashed: "#b91c1c",
  interrupted: "#f97316",
  unknown: "#71717a"
}

export const ChildrenTimeline = ({ points }: { points: ReadonlyArray<Point> }) => {
  if (points.length === 0) return null
  const ts = points.map((p) => p.t)
  const t0 = Math.min(...ts)
  const tMax = Math.max(...ts)
  const span = Math.max(tMax - t0, 1)
  const lastDelta = tMax - t0

  return (
    <div className="space-y-1">
      <div className="text-[11px] text-muted-foreground">
        Relative start times — span: {formatDelta(lastDelta)}
      </div>
      <svg
        viewBox="0 0 100 24"
        preserveAspectRatio="none"
        className="h-10 w-full overflow-visible"
        role="img"
        aria-label="Run timeline"
      >
        <line x1="0" y1="12" x2="100" y2="12" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.4" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={((p.t - t0) / span) * 100}
            cy="12"
            r={p.isParent ? 1.8 : 1.2}
            fill={STATUS_COLOR[p.status]}
            stroke="white"
            strokeWidth={p.isParent ? 0.5 : 0.3}
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>T+0</span>
        <span>+{formatDelta(lastDelta)}</span>
      </div>
    </div>
  )
}

export const formatDelta = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`
  const min = Math.floor(ms / 60_000)
  const sec = Math.round((ms % 60_000) / 1000)
  return `${min}m ${sec}s`
}

export type { Point as TimelinePoint }
