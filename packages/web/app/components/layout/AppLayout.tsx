import { css, type Handle, type RemixNode } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { FONTS_HREF, tk } from "../../ui/tokens.js"
import { Sidebar } from "./Sidebar.js"
import { Topbar } from "./Topbar.js"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EnvInfo {
  id: string
  name: string
  isDefault: boolean
}

export interface AppLayoutProps {
  children: RemixNode
  title?: string
  activeNav?: string
  environments?: ReadonlyArray<EnvInfo>
  activeEnvId?: string | null
  currentPath?: string
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  shell: css({
    margin: 0,
    fontFamily: tk.fontSans,
    color: tk.fg,
    background: tk.bg,
    minHeight: "100vh"
  }),
  layout: css({
    display: "flex",
    minHeight: "100vh"
  }),
  mainArea: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0
  }),
  content: css({
    flex: 1,
    overflowY: "auto"
  })
}

// ---------------------------------------------------------------------------
// AppLayout component
// ---------------------------------------------------------------------------

/**
 * Professional monitoring layout inspired by Grafana and Datadog.
 *
 * Renders the full HTML shell with:
 * - Fixed-width sidebar (left)
 * - Top status bar
 * - Main content area (children)
 */
export function AppLayout(handle: Handle<AppLayoutProps>) {
  return () => {
    const { children, title = "Workflow Viz", activeNav, environments, activeEnvId, currentPath } = handle.props

    const currentEnv = (environments ?? []).find((e) => e.id === activeEnvId)
    const isLive = currentEnv !== undefined

    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>{title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
          <style>{`
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.35; }
            }
          `}</style>
        </head>
        <body mix={s.shell}>
          <div mix={s.layout}>
            <Sidebar
              activeItem={activeNav}
              environments={environments ?? []}
              activeEnvId={activeEnvId ?? null}
              currentPath={currentPath ?? "/"}
            />
            <div mix={s.mainArea}>
              <Topbar
                currentEnvName={currentEnv?.name ?? null}
                isLive={isLive}
              />
              <div mix={s.content}>
                {children}
              </div>
            </div>
          </div>
          <script type="module" src="/assets/app/assets/entry.ts" />
        </body>
      </html>
    )
  }
}
