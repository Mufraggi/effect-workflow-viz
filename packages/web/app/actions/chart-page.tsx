import type { Role } from "@template/domain/auth/Role"
import { css, type Handle } from "remix/ui"
import { RunsScatter } from "../assets/runs-scatter.entry.js"
import { AppLayout, type EnvInfo } from "../components/layout/AppLayout.js"
import { routes } from "../routes.js"
import { tk } from "../ui/tokens.js"
import { type RunsFilters, type RunSummaryEncoded } from "../utils/runs.js"
import { FiltersForm } from "./runs-page.js"

export interface ChartPageProps {
  runs: ReadonlyArray<RunSummaryEncoded>
  fromMs: number
  toMs: number
  filters: RunsFilters
  query: string
  truncated: boolean
  environments: ReadonlyArray<EnvInfo>
  activeEnvId: string | null
  currentPath: string
  currentUserRole?: Role
}

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
    fontSize: ".82rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
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
 * Server-rendered chart page using the AppLayout shell.
 * The scatter (`RunsScatter`) is a hydrated client entry; the filter form
 * (shared with the runs list) drives the date range and other filters.
 */
export function ChartPage(handle: Handle<ChartPageProps>) {
  return () => {
    const { activeEnvId, currentPath, currentUserRole, environments, filters, fromMs, query, runs, toMs, truncated } =
      handle.props
    return (
      <AppLayout
        title="Chart — Workflow Viz"
        activeNav="executions"
        environments={environments}
        activeEnvId={activeEnvId}
        currentPath={currentPath}
        currentUserRole={currentUserRole}
      >
        <main mix={styles.container}>
          <header mix={styles.headerRow}>
            <div>
              <h1 mix={styles.h1}>Chart</h1>
              <p mix={styles.muted}>Start time × duration (log), colored by status.</p>
            </div>
            <span mix={styles.navGroup}>
              <a mix={styles.navLink} href={`${routes.home.href()}${query.length > 0 ? `?${query}` : ""}`}>List</a>
            </span>
          </header>

          {!activeEnvId ?
            (
              <div mix={styles.emptyState}>
                <span mix={styles.emptyIcon}>🔌</span>
                <h2 mix={styles.emptyTitle}>No environment selected</h2>
                <p mix={styles.emptyText}>
                  Select an environment from the sidebar to view the chart.
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
                <FiltersForm filters={filters} action={routes.chart.href()} />
                <RunsScatter
                  runs={[...runs]}
                  fromMs={fromMs}
                  toMs={toMs}
                  query={query}
                  truncated={truncated}
                />
              </>
            )}
        </main>
      </AppLayout>
    )
  }
}
