import type { Role } from "@template/domain/auth/Role"
import type { RunDetail } from "@template/domain/run/RunDetail"
import type { RunStatus } from "@template/domain/run/RunStatus"
import { findCauseLeaf } from "@template/domain/workflow/decode/exit"
import { getOutputCause } from "@template/domain/workflow/decode/workflow"
import type { Schema } from "effect"
import { css, type Handle, type RemixNode } from "remix/ui"
import { AppLayout } from "../components/layout/AppLayout.js"
import { routes } from "../routes.js"
import { STATUS_COLOR, tk } from "../ui/tokens.js"
import { fmtDate, fmtDuration } from "../utils/runs.js"

export type RunDetailEncoded = Schema.Schema.Encoded<typeof RunDetail>

const d = {
  container: css({ maxWidth: "48rem", margin: "0 auto", padding: "2.5rem 2rem" }),
  nav: css({ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }),
  back: css({
    fontSize: ".85rem",
    display: "inline-block",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  h1: css({
    margin: "0 0 .35rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.9rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  h2: css({
    fontSize: ".72rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "1.75rem 0 .5rem"
  }),
  mono: css({ fontFamily: tk.fontMono, fontSize: ".8rem", wordBreak: "break-all", color: tk.mutedFg }),
  muted: css({ color: tk.mutedFg, fontSize: ".9rem" }),
  link: css({ color: tk.primary, fontWeight: 500, textDecoration: "none", "&:hover": { textDecoration: "underline" } }),
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1.25rem 1.5rem",
    marginTop: ".75rem"
  }),
  meta: css({
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: ".4rem 1.25rem",
    fontSize: ".82rem",
    margin: "1.25rem 0",
    "& dt": { color: tk.mutedFg },
    "& dd": { margin: 0, fontFamily: tk.fontMono, wordBreak: "break-all" }
  }),
  banner: css({
    borderRadius: tk.radiusMd,
    padding: "1rem 1.25rem",
    fontSize: ".9rem",
    border: `1px solid ${tk.border}`
  }),
  bannerError: css({ borderColor: tk.destructiveSoft, background: tk.destructiveSoft }),
  bannerWarn: css({ borderColor: tk.warningSoft, background: tk.warningSoft }),
  ok: css({ color: tk.success, margin: 0, fontWeight: 500 }),
  details: css({ marginTop: ".6rem" }),
  summary: css({ cursor: "pointer", fontSize: ".8rem", color: tk.mutedFg }),
  pre: css({
    maxHeight: "24rem",
    overflow: "auto",
    background: tk.bg,
    border: `1px solid ${tk.border}`,
    padding: ".85rem",
    borderRadius: tk.radiusSm,
    fontSize: ".75rem",
    fontFamily: tk.fontMono,
    marginTop: ".6rem"
  }),
  table: css({
    width: "100%",
    borderCollapse: "collapse",
    marginTop: ".5rem",
    fontSize: ".82rem",
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    overflow: "hidden",
    "& th": {
      textAlign: "left",
      padding: ".55rem .85rem",
      borderBottom: `1px solid ${tk.border}`,
      color: tk.mutedFg,
      fontWeight: 600,
      fontSize: ".68rem",
      textTransform: "uppercase",
      letterSpacing: ".04em"
    },
    "& td": { padding: ".55rem .85rem", borderBottom: `1px solid ${tk.border}`, fontFamily: tk.fontMono }
  }),
  tnum: css({ textAlign: "right", fontVariantNumeric: "tabular-nums" }),
  dot: css({ display: "inline-block", width: ".5rem", height: ".5rem", borderRadius: "999px" })
}

const badge = (status: RunStatus) => {
  const c = STATUS_COLOR[status] ?? "#6b7280"
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

const json = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

const fmtDelta = (ms: number): string => {
  const sign = ms >= 0 ? "+" : "−"
  const a = Math.abs(ms)
  if (a < 1000) return `${sign}${a}ms`
  if (a < 60_000) return `${sign}${(a / 1000).toFixed(1)}s`
  return `${sign}${(a / 60_000).toFixed(1)}m`
}

/** Server-rendered detail page using the AppLayout shell. */
export interface RunDetailPageProps {
  run: RunDetailEncoded
  environments?: ReadonlyArray<{ id: string; name: string; isDefault: boolean }>
  activeEnvId?: string | null
  currentPath?: string
  currentUserRole?: Role
}

export function RunDetailPage(handle: Handle<RunDetailPageProps>) {
  return () => {
    const { activeEnvId, currentPath, currentUserRole, environments, run } = handle.props
    const parentTime = run.startedAt === null ? null : new Date(run.startedAt).getTime()
    const children = [...run.children].sort((a, b) => {
      const at = a.startedAt === null ? Infinity : new Date(a.startedAt).getTime()
      const bt = b.startedAt === null ? Infinity : new Date(b.startedAt).getTime()
      return at - bt
    })

    return (
      <AppLayout
        title={`Run ${run.workflowName} — Workflow Viz`}
        activeNav="executions"
        environments={environments ?? []}
        activeEnvId={activeEnvId ?? null}
        currentPath={currentPath ?? "/"}
        currentUserRole={currentUserRole}
      >
        <main mix={d.container}>
          <nav mix={d.nav}>
            <a mix={d.back} href={routes.home.href()}>← Back to runs</a>
            <a mix={d.back} href={routes.settings.href()}>⚙ Settings</a>
          </nav>

          <header mix={d.card}>
            <h1 mix={d.h1}>{run.workflowName}</h1>
            <div mix={d.mono}>{run.runId}</div>
            <p>
              <span mix={badge(run.status)}>{run.status}</span>
            </p>
            <dl mix={d.meta}>
              <dt>Message ID</dt>
              <dd>{run.id}</dd>
              <dt>Trace ID</dt>
              <dd>{run.traceId ?? "—"}</dd>
              <dt>Shard</dt>
              <dd>{run.shardId}</dd>
              <dt>Started (UTC)</dt>
              <dd>{fmtDate(run.startedAt)}</dd>
              <dt>Duration</dt>
              <dd>{fmtDuration(run.durationMs)}</dd>
            </dl>
          </header>

          {/* Error / output / exit value */}
          <OutputSection
            status={run.status}
            output={run.output}
          />

          {/* Children */}
          {children.length > 0 && (
            <section>
              <h2 mix={d.h2}>Children ({children.length})</h2>
              <table mix={d.table}>
                <thead>
                  <tr>
                    <th>Workflow</th>
                    <th>Run ID</th>
                    <th>Status</th>
                    <th mix={d.tnum}>Duration</th>
                    <th mix={d.tnum}>Δ parent</th>
                  </tr>
                </thead>
                <tbody>
                  {children.map((ch) => {
                    const chStart = ch.startedAt === null ? null : new Date(ch.startedAt).getTime()
                    const delta = parentTime !== null && chStart !== null ? chStart - parentTime : null
                    return (
                      <tr key={ch.runId}>
                        <td>
                          <a mix={d.link} href={routes.runShow.href({ messageId: ch.id })}>
                            {ch.workflowName}
                          </a>
                        </td>
                        <td mix={d.mono}>{ch.runId}</td>
                        <td>
                          <span mix={badge(ch.status)}>{ch.status}</span>
                        </td>
                        <td mix={d.tnum}>{fmtDuration(ch.durationMs)}</td>
                        <td mix={d.tnum}>{delta !== null ? fmtDelta(delta) : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )}
        </main>
      </AppLayout>
    )
  }
}

// ---------------------------------------------------------------------------
// Output section — shows the run's output/error based on status
// ---------------------------------------------------------------------------

function OutputSection(handle: Handle<{ status: RunStatus; output: unknown }>) {
  return (): RemixNode => {
    const { output, status } = handle.props

    switch (status) {
      case "success":
      case "crashed":
      case "failed_app": {
        const cause = getOutputCause(output)

        if (cause === null) return null

        // Show the first "Fail" leaf for failed_app, "Die" leaf for crashed.
        const targetTag = status === "failed_app" ? "Fail" : "Die"
        const leaf = findCauseLeaf(cause, targetTag)

        const msg = leaf === null ? null : extractMessage(leaf)

        if (status === "success") {
          return (
            <div>
              <div mix={d.ok}>{extractMessage(cause) ?? "OK"}</div>
              <Raw label="Show raw output" value={cause} />
            </div>
          )
        }

        // crashed / failed_app
        const defect = leaf === null ? null : extractDefect(leaf["defect"])
        return (
          <div>
            {msg !== null && (
              <div mix={[d.banner, d.bannerError]}>
                <strong>{status === "crashed" ? "Defect" : "Error"}:</strong>
                {msg}
              </div>
            )}
            {defect !== null && (
              <>
                <div>
                  <strong>{defect.name ?? targetTag}</strong>
                  {defect.message !== null && <pre mix={d.pre}>{defect.message}</pre>}
                </div>
                {defect.stack !== null && <Raw label="Show stack" value={defect.stack} preformatted />}
              </>
            )}
            <Raw label="Show raw cause" value={cause} />
          </div>
        )
      }
      case "interrupted": {
        const cause = getOutputCause(output)
        const interrupt = cause === null ? null : findCauseLeaf(cause, "Interrupt")
        const fiber = interrupt === null ? null : formatFiberId(interrupt["fiberId"])
        return (
          <div>
            <div mix={[d.banner, d.bannerWarn]}>
              <strong>Interrupted</strong>
              {fiber !== null && <div mix={d.mono}>fiber {fiber}</div>}
            </div>
            <Raw label="Show raw cause" value={cause ?? output} />
          </div>
        )
      }
      case "pending":
        return <p mix={d.muted}>Not started yet.</p>
      case "running":
        return <p mix={d.muted}>Still running.</p>
      case "unknown":
        return <Raw label="Show raw output" value={output} open />
    }
  }
}

function Raw(handle: Handle<{ label: string; value: unknown; open?: boolean; preformatted?: boolean }>) {
  return (): RemixNode => {
    const { label, open, preformatted, value } = handle.props
    if (value === null || value === undefined) return null
    return (
      <details mix={d.details} open={open ?? false}>
        <summary mix={d.summary}>{label}</summary>
        <pre mix={d.pre}>{preformatted && typeof value === "string" ? value : json(value)}</pre>
      </details>
    )
  }
}

const extractMessage = (err: unknown): string | null => {
  if (err === null || err === undefined) return null
  if (typeof err === "string") return err
  if (typeof err === "object") {
    const message = (err as Record<string, unknown>)["message"]
    return typeof message === "string" ? message : json(err)
  }
  return String(err)
}

const extractDefect = (defect: unknown): { name: string | null; message: string | null; stack: string | null } => {
  if (defect === null || defect === undefined) return { name: null, message: null, stack: null }
  if (typeof defect === "string") return { name: null, message: defect, stack: null }
  if (typeof defect === "object") {
    const obj = defect as Record<string, unknown>
    return {
      name: typeof obj["name"] === "string" ? obj["name"] : null,
      message: typeof obj["message"] === "string" ? obj["message"] : null,
      stack: typeof obj["stack"] === "string" ? obj["stack"] : null
    }
  }
  return { name: null, message: String(defect), stack: null }
}

const formatFiberId = (fiberId: unknown): string | null => {
  if (fiberId === null || fiberId === undefined) return null
  if (typeof fiberId !== "object") return String(fiberId)
  const obj = fiberId as Record<string, unknown>
  if (typeof obj["id"] === "number") return `#${obj["id"]}`
  if (obj["_tag"] === "Composite") return "<composite>"
  return null
}
