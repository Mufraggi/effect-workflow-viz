import type { RunDetail } from "@template/domain/run/RunDetail"
import { findCauseLeaf } from "@template/domain/workflow/decode/exit"
import { getOutputCause, unwrapWorkflowResult } from "@template/domain/workflow/decode/workflow"
import type { Schema } from "effect"
import { css, type Handle, type RemixNode } from "remix/ui"
import { AppLayout } from "../components/layout/AppLayout.js"
import { routes } from "../routes.js"
import { STATUS_COLOR, tk } from "../ui/tokens.js"
import { fmtDate, fmtDuration } from "../utils/runs.js"

export type RunDetailEncoded = Schema.Schema.Encoded<typeof RunDetail>

// ---------------------------------------------------------------------------
// Status presentation
// ---------------------------------------------------------------------------

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  running: "Running",
  success: "Success",
  failed_app: "Failed",
  crashed: "Crashed",
  interrupted: "Interrupted",
  unknown: "Unknown"
}

type Tone = "success" | "danger" | "warning" | "neutral"

const TONE_COLOR: Record<Tone, string> = {
  success: tk.success,
  danger: tk.destructive,
  warning: tk.warning,
  neutral: tk.border
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const d = {
  container: css({ maxWidth: "52rem", margin: "0 auto", padding: "2.5rem 2rem 3rem" }),
  back: css({
    fontSize: ".85rem",
    display: "inline-block",
    marginBottom: "1.25rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  header: css({ marginBottom: "1.5rem" }),
  h1: css({
    margin: "0 0 .35rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.9rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  execId: css({ fontFamily: tk.fontMono, fontSize: ".85rem", color: tk.mutedFg, wordBreak: "break-all" }),
  badgeRow: css({ marginTop: ".75rem" }),
  // ── Metric cards ──────────────────────────────────────────────────────
  metrics: css({
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: ".75rem",
    margin: "1.5rem 0"
  }),
  metricCard: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusMd,
    padding: "1rem 1.25rem"
  }),
  metricLabel: css({
    fontSize: ".68rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "0 0 .4rem"
  }),
  metricValue: css({ fontFamily: tk.fontMono, fontSize: ".95rem", color: tk.fg, wordBreak: "break-all" }),
  // ── Sections ──────────────────────────────────────────────────────────
  section: css({ marginTop: "1.75rem" }),
  sectionLabel: css({
    fontSize: ".72rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "0 0 .5rem"
  }),
  pre: css({
    maxHeight: "26rem",
    overflow: "auto",
    background: tk.bg,
    border: `1px solid ${tk.border}`,
    padding: ".85rem 1rem",
    borderRadius: tk.radiusSm,
    fontSize: ".78rem",
    fontFamily: tk.fontMono,
    lineHeight: 1.5,
    margin: 0
  }),
  // ── Trace metadata ────────────────────────────────────────────────────
  details: css({ marginTop: "2rem", borderTop: `1px solid ${tk.borderLight}`, paddingTop: "1rem" }),
  summary: css({ cursor: "pointer", fontSize: ".78rem", color: tk.mutedFg, fontWeight: 500 }),
  meta: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: ".4rem 1.25rem",
    fontSize: ".8rem",
    marginTop: ".85rem",
    "& dt": { color: tk.mutedFg },
    "& dd": { margin: 0, fontFamily: tk.fontMono, wordBreak: "break-all" }
  })
}

const badge = (status: string) => {
  const c = STATUS_COLOR[status] ?? "#6b7280"
  return css({
    display: "inline-block",
    padding: ".2rem .7rem",
    borderRadius: "999px",
    fontSize: ".75rem",
    fontWeight: 600,
    fontFamily: tk.fontMono,
    color: c,
    background: `${c}1f`
  })
}

const json = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// ---------------------------------------------------------------------------
// Duration label (honest, never "—" for a terminal run)
// ---------------------------------------------------------------------------

const fmtElapsed = (ms: number): string => {
  if (ms < 1000) return "<1s"
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
  return `${Math.floor(ms / 3_600_000)}h ${Math.floor((ms % 3_600_000) / 60_000)}m`
}

const durationLabel = (run: RunDetailEncoded): string => {
  if (run.status === "running") {
    if (run.startedAt === null) return "—"
    const elapsed = Date.now() - new Date(run.startedAt).getTime()
    return Number.isNaN(elapsed) || elapsed < 0 ? "—" : fmtElapsed(elapsed)
  }
  if (run.durationMs !== null) return fmtDuration(run.durationMs)
  // Terminal run with a reply but a non-positive Snowflake delta: effectively
  // instant. A terminal run always has a reply, so never show "—" here.
  if (run.replyId !== null) return "<1s"
  return "—"
}

// ---------------------------------------------------------------------------
// Exit decoding — reuses the domain decode helpers, never reconstructs.
// ---------------------------------------------------------------------------

const decodeExit = (run: RunDetailEncoded): { value: unknown; tone: Tone } | null => {
  switch (run.status) {
    case "success": {
      const inner = unwrapWorkflowResult(
        run.output !== null && typeof run.output === "object"
          ? (run.output as Record<string, unknown>)["value"]
          : null
      )
      const value = inner !== null && typeof inner === "object"
        ? (inner as Record<string, unknown>)["value"] ?? inner
        : run.output
      return { value, tone: "success" }
    }
    case "failed_app": {
      const cause = getOutputCause(run.output)
      const leaf = cause === null ? null : findCauseLeaf(cause, "Fail")
      return { value: leaf?.["error"] ?? cause ?? run.output, tone: "danger" }
    }
    case "crashed": {
      const cause = getOutputCause(run.output)
      const leaf = cause === null ? null : findCauseLeaf(cause, "Die")
      return { value: leaf?.["defect"] ?? cause ?? run.output, tone: "danger" }
    }
    case "interrupted": {
      const cause = getOutputCause(run.output)
      const leaf = cause === null ? null : findCauseLeaf(cause, "Interrupt")
      return { value: leaf ?? cause ?? run.output, tone: "warning" }
    }
    case "running":
    case "pending":
      return null
    default:
      // unknown — surface whatever terminal payload exists, untyped.
      return run.output === null ? null : { value: run.output, tone: "neutral" }
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface ExecutionDetailPageProps {
  run: RunDetailEncoded
  environments?: ReadonlyArray<{ id: string; name: string; isDefault: boolean }>
  activeEnvId?: string | null
  currentPath?: string
}

export function ExecutionDetailPage(handle: Handle<ExecutionDetailPageProps>) {
  return (): RemixNode => {
    const { activeEnvId, currentPath, environments, run } = handle.props
    const exit = decodeExit(run)

    return (
      <AppLayout
        title={`${run.workflowName} — Execution — Workflow Viz`}
        activeNav="executions"
        environments={environments ?? []}
        activeEnvId={activeEnvId ?? null}
        currentPath={currentPath ?? "/"}
      >
        <main mix={d.container}>
          <a mix={d.back} href={routes.executions.href()}>← Back to executions</a>

          {/* Header: workflow + executionId + status */}
          <header mix={d.header}>
            <h1 mix={d.h1}>{run.workflowName}</h1>
            <div mix={d.execId}>{run.runId}</div>
            <div mix={d.badgeRow}>
              <span mix={badge(run.status)}>{STATUS_LABEL[run.status] ?? run.status}</span>
            </div>
          </header>

          {/* Metric cards */}
          <div mix={d.metrics}>
            <div mix={d.metricCard}>
              <p mix={d.metricLabel}>Duration</p>
              <div mix={d.metricValue}>{durationLabel(run)}</div>
            </div>
            <div mix={d.metricCard}>
              <p mix={d.metricLabel}>Started (UTC)</p>
              <div mix={d.metricValue}>{fmtDate(run.startedAt)}</div>
            </div>
            {run.shardId && (
              <div mix={d.metricCard}>
                <p mix={d.metricLabel}>Shard</p>
                <div mix={d.metricValue}>{run.shardId}</div>
              </div>
            )}
          </div>

          {/* Input payload — only when the message actually carried one */}
          {run.input !== null && (
            <section mix={d.section}>
              <p mix={d.sectionLabel}>Input payload</p>
              <pre mix={d.pre}>{json(run.input)}</pre>
            </section>
          )}

          {/* Exit — polymorphic by status, colored border; absent while running */}
          {exit !== null && (
            <section mix={d.section}>
              <p mix={d.sectionLabel}>Exit</p>
              <pre mix={[d.pre, css({ borderColor: TONE_COLOR[exit.tone] })]}>{json(exit.value)}</pre>
            </section>
          )}

          {/* Trace metadata — collapsed technical detail */}
          <details mix={d.details}>
            <summary mix={d.summary}>Trace metadata</summary>
            <dl mix={d.meta}>
              <dt>Message ID</dt>
              <dd>{run.id}</dd>
              <dt>Trace ID</dt>
              <dd>{run.traceId ?? "—"}</dd>
              <dt>Reply ID</dt>
              <dd>{run.replyId ?? "—"}</dd>
            </dl>
          </details>
        </main>
      </AppLayout>
    )
  }
}
