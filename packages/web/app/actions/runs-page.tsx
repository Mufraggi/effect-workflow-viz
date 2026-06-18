import { RunStatus } from "@template/domain/run/RunStatus"
import { css, type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { RunsList } from "../assets/runs-list.entry.js"
import { routes } from "../routes.js"
import { FONTS_HREF, tk } from "../ui/tokens.js"
import { type RunsFilters, type RunSummaryEncoded } from "../utils/runs.js"

export type { RunsFilters, RunSummaryEncoded }

export interface RunsPageProps {
  runs: ReadonlyArray<RunSummaryEncoded>
  nextCursor: string | null
  filters: RunsFilters
  query: string
  environments: ReadonlyArray<{ id: string; name: string; isDefault: boolean }>
  activeEnvId: string | null
}

const STATUS_OPTIONS = RunStatus.literals

const hasActiveFilter = (f: RunsFilters): boolean =>
  f.status.length > 0 || f.workflowName !== null || f.traceId !== null || f.from !== null || f.to !== null

// ISO (UTC) → the `YYYY-MM-DDTHH:mm` shape a <input type="datetime-local"> wants.
const toLocalInput = (iso: string | null): string => (iso === null ? "" : iso.slice(0, 16))

const styles = {
  body: css({ margin: 0, fontFamily: tk.fontSans, color: tk.fg, background: tk.bg }),
  container: css({ maxWidth: "72rem", margin: "0 auto", padding: "2.5rem 2rem" }),
  h1: css({
    margin: "0 0 .25rem",
    fontFamily: tk.fontSerif,
    fontSize: "2rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  muted: css({ color: tk.mutedFg, fontSize: ".9rem", margin: 0 }),
  headerRow: css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }),
  navGroup: css({ flexShrink: 0, display: "flex", gap: "1rem" }),
  navLink: css({
    flexShrink: 0,
    fontSize: ".85rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1.25rem 1.5rem",
    margin: "1.5rem 0"
  }),
  form: css({ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }),
  field: css({ display: "flex", flexDirection: "column", gap: ".4rem" }),
  lbl: css({ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: tk.mutedFg }),
  pills: css({ display: "flex", flexWrap: "wrap", gap: ".4rem" }),
  pill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".2rem .6rem",
    border: `1px solid ${tk.border}`,
    borderRadius: "999px",
    fontSize: ".72rem",
    fontFamily: tk.fontMono,
    cursor: "pointer",
    userSelect: "none",
    background: tk.bg
  }),
  input: css({
    padding: ".45rem .65rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".85rem",
    minWidth: "13rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  actions: css({ display: "flex", gap: ".5rem" }),
  btn: css({
    padding: ".5rem 1rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".85rem",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    "&:hover": { background: tk.hoverBg }
  }),
  btnPrimary: css({
    border: `1px solid ${tk.primary}`,
    color: tk.primaryFg,
    background: tk.primary,
    "&:hover": { background: tk.primary, opacity: 0.9 }
  })
}

/**
 * Server-rendered Runs page styled with Remix 3's `css()` mixin + the RMX_01
 * theme/reset. The runs table is a hydrated `RunsList` client entry.
 */
export function RunsPage(handle: Handle<RunsPageProps>) {
  return () => {
    const { activeEnvId, environments, filters, nextCursor, query, runs } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Runs</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={styles.body}>
          <main mix={styles.container}>
            <header mix={styles.headerRow}>
              <div>
                <h1 mix={styles.h1}>Runs</h1>
                <p mix={styles.muted}>Workflow runs — server-rendered with Remix 3.</p>
              </div>
              <span mix={styles.navGroup}>
                {/* Environment switcher: GET form submits ?envId=xxx&returnTo=... */}
                <form method="get" action={routes.selectEnv.href()} style={{ display: "inline" }}>
                  <select
                    name="envId"
                    style={{
                      padding: ".35rem .5rem",
                      border: "1px solid #e4e4e7",
                      borderRadius: "6px",
                      background: "inherit",
                      color: "inherit",
                      font: "inherit",
                      fontSize: ".8rem",
                      cursor: "pointer"
                    }}
                  >
                    {!activeEnvId && <option value="">Default (env vars)</option>}
                    {environments.map((e) => (
                      <option
                        value={e.id}
                        selected={e.id === activeEnvId}
                      >
                        {e.name}
                        {e.isDefault ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" name="returnTo" value={"/"} />
                  <button
                    type="submit"
                    style={{
                      padding: ".35rem .6rem",
                      border: "1px solid #e4e4e7",
                      borderRadius: "6px",
                      background: "inherit",
                      color: "inherit",
                      font: "inherit",
                      fontSize: ".8rem",
                      cursor: "pointer",
                      marginLeft: ".35rem"
                    }}
                  >
                    Go
                  </button>
                </form>
                <a mix={styles.navLink} href={`${routes.chart.href()}${query.length > 0 ? `?${query}` : ""}`}>
                  📈 Chart
                </a>
                <a mix={styles.navLink} href={routes.settings.href()}>⚙ Settings</a>
              </span>
            </header>

            <FiltersForm filters={filters} action={routes.home.href()} />

            <RunsList runs={[...runs]} nextCursor={nextCursor} query={query} />
          </main>
          <script type="module" src="/assets/app/assets/entry.ts"></script>
        </body>
      </html>
    )
  }
}

// Plain GET form: submitting sets the query params that the controller's
// `parseFilter` already reads (status, workflowName, traceId, from, to).
// Shared by the runs list and the chart page via the `action` prop.
export function FiltersForm(handle: Handle<{ filters: RunsFilters; action: string }>) {
  return () => {
    const { action, filters } = handle.props
    return (
      <form mix={[styles.card, styles.form]} method="get" action={action}>
        <div mix={styles.field}>
          <span mix={styles.lbl}>Status</span>
          <div mix={styles.pills}>
            {STATUS_OPTIONS.map((s) => (
              <label mix={styles.pill}>
                <input type="checkbox" name="status" value={s} checked={filters.status.includes(s)} />
                {s}
              </label>
            ))}
          </div>
        </div>

        <div mix={styles.field}>
          <span mix={styles.lbl}>Workflow name</span>
          <input
            mix={styles.input}
            type="text"
            name="workflowName"
            placeholder="prefix…"
            value={filters.workflowName ?? ""}
          />
        </div>

        <div mix={styles.field}>
          <span mix={styles.lbl}>Trace ID</span>
          <input
            mix={styles.input}
            type="text"
            name="traceId"
            placeholder="trace…"
            value={filters.traceId ?? ""}
          />
        </div>

        <div mix={styles.field}>
          <span mix={styles.lbl}>From (UTC)</span>
          <input mix={styles.input} type="datetime-local" name="from" value={toLocalInput(filters.from)} />
        </div>

        <div mix={styles.field}>
          <span mix={styles.lbl}>To (UTC)</span>
          <input mix={styles.input} type="datetime-local" name="to" value={toLocalInput(filters.to)} />
        </div>

        <div mix={styles.actions}>
          <button mix={[styles.btn, styles.btnPrimary]} type="submit">Apply</button>
          {hasActiveFilter(filters) && <a mix={styles.btn} href={action}>Clear</a>}
        </div>
      </form>
    )
  }
}
