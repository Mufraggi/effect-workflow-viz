import { css, type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { routes } from "../routes.js"
import { FONTS_HREF, tk } from "../ui/tokens.js"
import { type RunsFilters, type RunSummaryEncoded } from "../utils/runs.js"
import { FiltersForm } from "./runs-page.js"
import { RunsScatter } from "./runs-scatter.entry.js"

export interface ChartPageProps {
  runs: ReadonlyArray<RunSummaryEncoded>
  fromMs: number
  toMs: number
  filters: RunsFilters
  query: string
  truncated: boolean
}

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
    fontSize: ".85rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  })
}

/**
 * Server-rendered chart page. The scatter (`RunsScatter`) is a hydrated client
 * entry; the filter form (shared with the runs list) drives the date range and
 * other filters via a plain GET navigation.
 */
export function ChartPage(handle: Handle<ChartPageProps>) {
  return () => {
    const { filters, fromMs, query, runs, toMs, truncated } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Runs · Chart</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={styles.body}>
          <main mix={styles.container}>
            <header mix={styles.headerRow}>
              <div>
                <h1 mix={styles.h1}>Chart</h1>
                <p mix={styles.muted}>Start time × duration (log), colored by status.</p>
              </div>
              <span mix={styles.navGroup}>
                <a mix={styles.navLink} href={`${routes.home.href()}${query.length > 0 ? `?${query}` : ""}`}>≣ List</a>
                <a mix={styles.navLink} href={routes.settings.href()}>⚙ Settings</a>
              </span>
            </header>

            <FiltersForm filters={filters} action={routes.chart.href()} />

            <RunsScatter
              runs={[...runs]}
              fromMs={fromMs}
              toMs={toMs}
              query={query}
              truncated={truncated}
            />
          </main>
          <script type="module" src="/assets/app/assets/entry.ts"></script>
        </body>
      </html>
    )
  }
}
