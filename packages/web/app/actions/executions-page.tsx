import type { Role } from "@template/domain/auth/Role"
import { css, type Handle } from "remix/ui"
import { type ExecutionRow, ExecutionsEntry } from "../assets/executions.entry.js"
import { AppLayout, type EnvInfo } from "../components/layout/AppLayout.js"
import { tk } from "../ui/tokens.js"

export type { ExecutionRow }

export interface ExecutionsPageProps {
  executions: ReadonlyArray<ExecutionRow> | null
  environments: ReadonlyArray<EnvInfo>
  activeEnvId: string | null
  currentPath: string
  currentUserRole?: Role
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

export function ExecutionsPage(handle: Handle<ExecutionsPageProps>) {
  return () => {
    const { activeEnvId, currentPath, currentUserRole, environments, executions } = handle.props
    return (
      <AppLayout
        title="Executions — Workflow Viz"
        activeNav="executions"
        environments={environments}
        activeEnvId={activeEnvId}
        currentPath={currentPath}
        currentUserRole={currentUserRole}
      >
        {!activeEnvId ?
          (
            <div mix={s.emptyState}>
              <span mix={s.emptyIcon}>🔌</span>
              <h2 mix={s.emptyTitle}>No environment selected</h2>
              <p mix={s.emptyText}>
                Select an environment from the sidebar to view workflow executions.
              </p>
            </div>
          ) :
          executions === null ?
          (
            <div mix={s.emptyState}>
              <span mix={s.emptyIcon}>⚠</span>
              <h2 mix={s.emptyTitle}>Failed to load executions</h2>
              <p mix={s.emptyText}>
                Could not fetch execution data from the database.
              </p>
            </div>
          ) :
          <ExecutionsEntry executions={[...executions]} />}
      </AppLayout>
    )
  }
}
