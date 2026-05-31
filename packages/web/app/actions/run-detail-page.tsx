import { RunDetail } from "@template/domain/run/RunDetail"
import type { RunStatus } from "@template/domain/run/RunStatus"
import { findCauseLeaf } from "@template/domain/workflow/decode/exit"
import { getOutputCause } from "@template/domain/workflow/decode/workflow"
import { css, type Handle, type RemixNode } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { Schema } from "effect"
import { routes } from "../routes.js"
import { FONTS_HREF, STATUS_COLOR, tk } from "../ui/tokens.js"
import { fmtDate } from "../utils/runs.js"

export type RunDetailEncoded = Schema.Schema.Encoded<typeof RunDetail>
type ChildEncoded = RunDetailEncoded["children"][number]

const d = {
  body: css({ margin: 0, fontFamily: tk.fontSans, color: tk.fg, background: tk.bg }),
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
  h1: css({ margin: "0 0 .35rem", fontFamily: tk.fontSerif, fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-.01em" }),
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
  banner: css({ borderRadius: tk.radiusMd, padding: "1rem 1.25rem", fontSize: ".9rem", border: `1px solid ${tk.border}` }),
  bannerError: css({ borderColor: "#dc262655", background: "#dc26260f" }),
  bannerWarn: css({ borderColor: "#c2410c55", background: "#c2410c0f" }),
  ok: css({ color: "#15803d", margin: 0, fontWeight: 500 }),
  details: css({ marginTop: ".6rem" }),
  summary: css({ cursor: "pointer", fontSize: ".8rem", color: tk.mutedFg }),
  pre: css({
    maxHeight: "24rem",
    overflow: "auto",
    background: tk.card,
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

/** Server-rendered detail page styled with Remix `css()` + RMX_01. Collapsibles use native <details>. */
export function RunDetailPage(handle: Handle<{ run: RunDetailEncoded }>) {
  return () => {
    const { run } = handle.props
    const parentTime = run.startedAtProxy === null ? null : new Date(run.startedAtProxy).getTime()
    const children = [...run.children].sort((a, b) => {
      const at = a.startedAtProxy === null ? Infinity : new Date(a.startedAtProxy).getTime()
      const bt = b.startedAtProxy === null ? Infinity : new Date(b.startedAtProxy).getTime()
      return at - bt
    })

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{`Run ${run.workflowName}`}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={d.body}>
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
                <dd>{fmtDate(run.startedAtProxy)}</dd>
              </dl>
            </header>

            <h2 mix={d.h2}>Output</h2>
            <OutputView status={run.status} output={run.output} />

            <h2 mix={d.h2}>Input</h2>
            {run.input === null
              ? <p mix={d.muted}>—</p>
              : (
                <details mix={d.details} open>
                  <summary mix={d.summary}>Show input</summary>
                  <pre mix={d.pre}>{json(run.input)}</pre>
                </details>
              )}

            <h2 mix={d.h2}>Children ({run.children.length})</h2>
            {children.length === 0
              ? <p mix={d.muted}>No child runs.</p>
              : (
                <table mix={d.table}>
                  <thead>
                    <tr>
                      <th></th>
                      <th>Workflow</th>
                      <th>Run ID</th>
                      <th mix={d.tnum}>Δ</th>
                      <th>Shard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {children.map((child) => <ChildRow child={child} parentTime={parentTime} />)}
                  </tbody>
                </table>
              )}
          </main>
          <script type="module" src="/assets/app/assets/entry.ts"></script>
        </body>
      </html>
    )
  }
}

function ChildRow(handle: Handle<{ child: ChildEncoded; parentTime: number | null }>) {
  return () => {
    const { child, parentTime } = handle.props
    const childTime = child.startedAtProxy === null ? null : new Date(child.startedAtProxy).getTime()
    const delta = parentTime !== null && childTime !== null ? childTime - parentTime : null
    return (
      <tr>
        <td>
          <span mix={d.dot} style={{ background: STATUS_COLOR[child.status] }} title={child.status} />
        </td>
        <td>{child.workflowName}</td>
        <td>
          <a mix={d.link} href={routes.runShow.href({ messageId: child.id })}>{child.runId}</a>
        </td>
        <td mix={d.tnum}>{delta === null ? "—" : fmtDelta(delta)}</td>
        <td>{child.shardId}</td>
      </tr>
    )
  }
}

function OutputView(handle: Handle<{ status: RunStatus; output: unknown }>) {
  return (): RemixNode => {
    const { output, status } = handle.props
    switch (status) {
      case "success":
        return (
          <div>
            <p mix={d.ok}>✓ Completed successfully</p>
            <Raw label="Show raw exit" value={output} />
          </div>
        )
      case "failed_app": {
        const cause = getOutputCause(output)
        const fail = cause === null ? null : findCauseLeaf(cause, "Fail")
        const message = fail === null ? null : extractMessage(fail["error"])
        return (
          <div>
            <div mix={[d.banner, d.bannerError]}>
              <strong>Application error</strong>
              {message !== null && <pre mix={d.pre}>{message}</pre>}
            </div>
            <Raw label="Show raw cause" value={cause ?? output} />
          </div>
        )
      }
      case "crashed": {
        const cause = getOutputCause(output)
        const die = cause === null ? null : findCauseLeaf(cause, "Die")
        const defect = extractDefect(die === null ? null : die["defect"])
        return (
          <div>
            <div mix={[d.banner, d.bannerError]}>
              <strong>{defect.name ?? "Defect"}</strong>
              {defect.message !== null && <pre mix={d.pre}>{defect.message}</pre>}
            </div>
            {defect.stack !== null && <Raw label="Show stack" value={defect.stack} preformatted />}
            <Raw label="Show raw cause" value={cause ?? output} />
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
