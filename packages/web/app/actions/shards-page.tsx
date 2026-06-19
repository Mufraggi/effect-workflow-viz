import { css, type Handle } from "remix/ui"
import { ShardsEntry } from "../assets/shards.entry.js"
import { AppLayout, type EnvInfo } from "../components/layout/AppLayout.js"
import type { OverviewSnapshot } from "../types/overview.js"
import { tk } from "../ui/tokens.js"

export interface ShardsPageProps {
  initialSnapshot: OverviewSnapshot | null
  environments: ReadonlyArray<EnvInfo>
  activeEnvId: string | null
  currentPath: string
}

const s = {
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
  }),
  navLink: css({
    fontSize: ".82rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  })
}

/**
 * Server-rendered Shards page shell.
 * The content is a hydrated `ShardsEntry` client entry that shows the
 * shard heatmap and runner details.
 */
export function ShardsPage(handle: Handle<ShardsPageProps>) {
  return () => {
    const { activeEnvId, currentPath, environments, initialSnapshot } = handle.props
    return (
      <AppLayout
        title="Shards — Workflow Viz"
        activeNav="shards"
        environments={environments}
        activeEnvId={activeEnvId}
        currentPath={currentPath}
      >
        {!activeEnvId ?
          (
            <div mix={s.emptyState}>
              <span mix={s.emptyIcon}>🔌</span>
              <h2 mix={s.emptyTitle}>No environment selected</h2>
              <p mix={s.emptyText}>
                Select an environment from the sidebar to view shard distribution.
                {environments.length === 0 && (
                  <>
                    No environments configured yet. Head to <a mix={s.navLink} href="/settings">Settings</a> to add one.
                  </>
                )}
              </p>
            </div>
          ) :
          initialSnapshot === null ?
          (
            <div mix={s.emptyState}>
              <span mix={s.emptyIcon}>⚠</span>
              <h2 mix={s.emptyTitle}>Failed to load shards</h2>
              <p mix={s.emptyText}>
                Could not fetch shard data from the database. Check your connection.
              </p>
            </div>
          ) :
          <ShardsEntry initialSnapshot={initialSnapshot} />}
      </AppLayout>
    )
  }
}
