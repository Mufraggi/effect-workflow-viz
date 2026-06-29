import type { Role } from "@template/domain/auth/Role"
import { RunStatus } from "@template/domain/run/RunStatus"
import { css, type Handle } from "remix/ui"
import { RunsList } from "../assets/runs-list.entry.js"
import { AppLayout, type EnvInfo } from "../components/layout/AppLayout.js"
import { routes } from "../routes.js"
import { tk } from "../ui/tokens.js"
import { type RunsFilters, type RunSummaryEncoded } from "../utils/runs.js"

export type { RunsFilters, RunSummaryEncoded }

export interface RunsPageProps {
  runs: ReadonlyArray<RunSummaryEncoded>
  nextCursor: string | null
  filters: RunsFilters
  query: string
  environments: ReadonlyArray<EnvInfo>
  activeEnvId: string | null
  currentPath: string
  currentUserRole?: Role
}

const STATUS_OPTIONS = RunStatus.literals

const hasActiveFilter = (f: RunsFilters): boolean =>
  f.status.length > 0 || f.workflowName !== null || f.traceId !== null || f.from !== null || f.to !== null

// ISO (UTC) → the `YYYY-MM-DDTHH:mm` shape a <input type="datetime-local"> wants.
const toLocalInput = (iso: string | null): string => (iso === null ? "" : iso.slice(0, 16))

const styles = {
  container: css({ maxWidth: "72rem", margin: "0 auto", padding: "2rem 2rem 3rem" }),
  h1: css({
    margin: "0 0 .25rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  muted: css({ color: tk.mutedFg, fontSize: ".85rem", margin: 0 }),
  headerRow: css({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }),
  navGroup: css({ flexShrink: 0, display: "flex", gap: ".75rem", alignItems: "center" }),
  navLink: css({
    flexShrink: 0,
    fontSize: ".82rem",
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
  lbl: css({ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: tk.mutedFg }),
  pills: css({ display: "flex", flexWrap: "wrap", gap: ".35rem" }),
  pill: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".2rem .55rem",
    border: `1px solid ${tk.border}`,
    borderRadius: "999px",
    fontSize: ".7rem",
    fontFamily: tk.fontMono,
    cursor: "pointer",
    userSelect: "none",
    background: tk.bg
  }),
  input: css({
    padding: ".4rem .6rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".82rem",
    minWidth: "12rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  actions: css({ display: "flex", gap: ".5rem" }),
  btn: css({
    padding: ".45rem .9rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".82rem",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    "&:hover": { background: tk.hoverBg }
  }),
  btnPrimary: css({
    border: `1px solid ${tk.primary}`,
    color: tk.primaryFg,
    background: tk.primary,
    "&:hover": { background: tk.primaryActive }
  }),
  emptyState: css({
    textAlign: "center",
    padding: "4rem 2rem",
    color: tk.mutedFg
  }),
  emptyIcon: css({
    fontSize: "2.5rem",
    marginBottom: "1rem",
    display: "block"
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

/**
 * Server-rendered Runs page using the AppLayout shell.
 * The runs table is a hydrated `RunsList` client entry.
 */
export function RunsPage(handle: Handle<RunsPageProps>) {
  return () => {
    const { activeEnvId, currentPath, currentUserRole, environments, filters, nextCursor, query, runs } = handle.props
    return (
      <AppLayout
        title="Runs — Workflow Viz"
        activeNav="executions"
        environments={environments}
        activeEnvId={activeEnvId}
        currentPath={currentPath}
        currentUserRole={currentUserRole}
      >
        <main mix={styles.container}>
          <header mix={styles.headerRow}>
            <div>
              <h1 mix={styles.h1}>Runs</h1>
              <p mix={styles.muted}>Workflow runs — server-rendered with Remix 3.</p>
            </div>
            <span mix={styles.navGroup}>
              <a mix={styles.navLink} href={`${routes.chart.href()}${query.length > 0 ? `?${query}` : ""}`}>
                Chart
              </a>
            </span>
          </header>

          {!activeEnvId ?
            (
              <div mix={styles.emptyState}>
                <span mix={styles.emptyIcon}>🔌</span>
                <h2 mix={styles.emptyTitle}>No environment selected</h2>
                <p mix={styles.emptyText}>
                  Select an environment from the sidebar to start browsing workflow runs.
                  {environments.length === 0 && (
                    <>
                      No environments configured yet. Head to <a mix={styles.navLink} href="/settings">Settings</a>{" "}
                      to add one.
                    </>
                  )}
                </p>
              </div>
            ) :
            (
              <>
                <FiltersForm filters={filters} action={routes.home.href()} />
                <RunsList runs={[...runs]} nextCursor={nextCursor} query={query} />
              </>
            )}
        </main>
      </AppLayout>
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
