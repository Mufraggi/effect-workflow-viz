import type { Role } from "@template/domain/auth/Role"
import { css, type Handle, type RemixNode } from "remix/ui"
import { EnvSelector } from "../../assets/env-selector.entry.js"
import { canView } from "../../auth/ClusterPolicies.js"
import { routes } from "../../routes.js"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Inline SVG wrapper
// ---------------------------------------------------------------------------

function Svg(handle: Handle<{ viewBox?: string; children: RemixNode }>) {
  return () => {
    const { children, viewBox = "0 0 24 24" } = handle.props
    return (
      <svg
        width="18"
        height="18"
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    )
  }
}

// ---------------------------------------------------------------------------
// Nav icons
// ---------------------------------------------------------------------------

function IconOverview() {
  return () => (
    <Svg>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </Svg>
  )
}

function IconNodes() {
  return () => (
    <Svg>
      <rect x="2" y="2" width="8" height="8" rx="2" />
      <rect x="14" y="2" width="8" height="8" rx="2" />
      <rect x="8" y="14" width="8" height="8" rx="2" />
    </Svg>
  )
}

function IconShards() {
  return () => (
    <Svg>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </Svg>
  )
}

function IconExecutions() {
  return () => (
    <Svg>
      <polygon points="6 3 20 12 6 21 6 3" />
    </Svg>
  )
}

function IconSchedules() {
  return () => (
    <Svg>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  )
}

function IconAlerts() {
  return () => (
    <Svg>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  )
}

function IconSettings() {
  return () => (
    <Svg>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Navigation item type
// ---------------------------------------------------------------------------

interface NavItem {
  id: string
  label: string
  icon: () => () => RemixNode
  section: "overview" | "cluster" | "workflows" | "bottom"
  href?: string
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { id: "overview", label: "Overview", icon: IconOverview, section: "overview", href: routes.overview.href() },
  { id: "nodes", label: "Nodes", icon: IconNodes, section: "cluster", href: routes.nodes.href() },
  { id: "shards", label: "Shards", icon: IconShards, section: "cluster", href: routes.shards.href() },
  { id: "executions", label: "Executions", icon: IconExecutions, section: "workflows", href: routes.executions.href() },
  { id: "schedules", label: "Schedules", icon: IconSchedules, section: "workflows" },
  { id: "alerts", label: "Alerts", icon: IconAlerts, section: "bottom" },
  { id: "settings", label: "Settings", icon: IconSettings, section: "bottom", href: routes.settings.href() }
]

// Map nav item ids to policy entity/action pairs for role-based filtering.
// Schedules and alerts are left out (kept visible for all roles).
const navItemPolicy: Record<string, { entity: string; action: string } | undefined> = {
  overview: { entity: "cluster", action: "overview" },
  nodes: { entity: "cluster", action: "nodes" },
  shards: { entity: "cluster", action: "shards" },
  executions: { entity: "workflow", action: "list" },
  settings: { entity: "config", action: "settings" }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  shell: css({
    width: tk.sidebarWidth,
    minWidth: tk.sidebarWidth,
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: tk.sidebarBg,
    borderRight: `1px solid ${tk.borderLight}`,
    overflow: "hidden",
    position: "sticky",
    top: 0
  }),

  // ── Header ──────────────────────────────────────────────────────────────
  header: css({
    display: "flex",
    alignItems: "center",
    gap: ".625rem",
    padding: "1rem 1rem .5rem"
  }),
  logo: css({
    width: "2rem",
    height: "2rem",
    borderRadius: tk.radiusSm,
    background: tk.primary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: tk.primaryFg,
    fontWeight: 700,
    fontSize: ".85rem",
    fontFamily: tk.fontMono
  }),
  headerText: css({
    display: "flex",
    flexDirection: "column",
    gap: ".15rem",
    minWidth: 0
  }),
  envName: css({
    fontSize: ".82rem",
    fontWeight: 600,
    color: tk.fg,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }),
  envNameLink: css({
    fontSize: ".82rem",
    fontWeight: 600,
    color: tk.primary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textDecoration: "none",
    cursor: "pointer",
    "&:hover": { textDecoration: "underline" }
  }),
  statusRow: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem"
  }),
  statusDot: css({
    width: ".45rem",
    height: ".45rem",
    borderRadius: "50%",
    background: tk.success,
    flexShrink: 0
  }),
  statusDotOff: css({
    width: ".45rem",
    height: ".45rem",
    borderRadius: "50%",
    background: tk.dimmedFg,
    flexShrink: 0
  }),
  statusLabel: css({
    fontSize: ".72rem",
    color: tk.success,
    fontWeight: 500
  }),
  statusLabelOff: css({
    fontSize: ".72rem",
    color: tk.dimmedFg,
    fontWeight: 500
  }),
  ctaLink: css({
    fontSize: ".72rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),

  // ── Environment selector CTA (no-env case) ───────────────────────────────
  envForm: css({
    display: "flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".25rem 1rem .5rem"
  }),

  // ── Nav sections ────────────────────────────────────────────────────────
  sectionLabel: css({
    fontSize: ".65rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: ".06em",
    color: tk.dimmedFg,
    padding: ".75rem 1rem .35rem"
  }),
  navList: css({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: ".125rem"
  }),
  navItem: css({
    display: "flex",
    alignItems: "center",
    gap: ".625rem",
    padding: ".45rem 1rem",
    margin: "0 .5rem",
    borderRadius: tk.radiusSm,
    fontSize: ".82rem",
    fontWeight: 500,
    color: tk.mutedFg,
    textDecoration: "none",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    "&:hover": {
      background: tk.hoverBg,
      color: tk.fg
    }
  }),
  navItemActive: css({
    background: tk.primarySoft,
    color: tk.primary,
    "&:hover": {
      background: tk.primarySoft,
      color: tk.primary
    }
  }),
  navItemDisabled: css({
    color: tk.dimmedFg,
    cursor: "not-allowed",
    opacity: 0.55,
    "&:hover": {
      background: "transparent",
      color: tk.dimmedFg
    }
  }),
  navIcon: css({
    width: "1.125rem",
    height: "1.125rem",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7
  }),
  navIconActive: css({
    opacity: 1
  }),
  navIconDisabled: css({
    opacity: 0.4
  }),
  navLabel: css({
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  }),
  scrollArea: css({
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: ".5rem"
  }),
  bottomSection: css({
    borderTop: `1px solid ${tk.borderLight}`,
    paddingTop: ".25rem",
    paddingBottom: ".625rem"
  })
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------

export function Sidebar(
  handle: Handle<{
    activeItem?: string
    environments?: ReadonlyArray<{ id: string; name: string; isDefault: boolean }>
    activeEnvId?: string | null
    currentPath?: string
    currentUserRole?: Role | null
  }>
) {
  return () => {
    // UI only — backend is authoritative. Navigation items are hidden by role
    // as a convenience, but every guarded handler enforces via authorize().
    const { activeEnvId = null, activeItem, currentPath = "/", currentUserRole = null, environments = [] } =
      handle.props

    const currentEnv = environments.find((e) => e.id === activeEnvId)
    const hasEnvs = environments.length > 0

    const isLive = currentEnv !== undefined

    // Filter nav items based on the current user's role.
    const NAV_ITEMS_VISIBLE = currentUserRole !== null
      ? NAV_ITEMS.filter((item) => {
        const mapping = navItemPolicy[item.id]
        if (!mapping) return true // items like schedules/alerts are unfiltered
        return canView(currentUserRole, mapping.entity, mapping.action)
      })
      : NAV_ITEMS

    const renderNavItem = (item: NavItem) => {
      const isActive = item.id === activeItem && isLive
      const Icon = item.icon
      const href = item.href ?? (isLive ? `#${item.id}` : undefined)
      return (
        <a
          mix={[s.navItem, isActive ? s.navItemActive : null, !isLive && !item.href ? s.navItemDisabled : null]}
          href={href}
          aria-disabled={!isLive && !item.href}
        >
          <span mix={[s.navIcon, isActive ? s.navIconActive : null, !isLive && !item.href ? s.navIconDisabled : null]}>
            <Icon />
          </span>
          <span mix={s.navLabel}>{item.label}</span>
        </a>
      )
    }

    const topItems = NAV_ITEMS_VISIBLE.filter((i) => i.section !== "bottom")
    const bottomItems = NAV_ITEMS_VISIBLE.filter((i) => i.section === "bottom")

    return (
      <aside mix={s.shell}>
        {/* ── Header: logo + environment info ── */}
        <div mix={s.header}>
          {currentEnv && <div mix={s.logo}>{currentEnv.name.charAt(0).toUpperCase()}</div>}
          <div mix={s.headerText}>
            {currentEnv ? <span mix={s.envName}>{currentEnv.name}</span> : (
              <span mix={s.envNameLink}>
                {hasEnvs ? "Select environment" : "No environment"}
              </span>
            )}
            <span mix={s.statusRow}>
              {currentEnv ?
                (
                  <>
                    <span mix={s.statusDot} />
                    <span mix={s.statusLabel}>Connected</span>
                  </>
                ) :
                hasEnvs ?
                (
                  <>
                    <span mix={s.statusDotOff} />
                    <span mix={s.statusLabelOff}>Disconnected</span>
                  </>
                ) :
                (
                  <>
                    <span mix={s.statusDotOff} />
                    <span mix={s.statusLabelOff}>Not configured</span>
                  </>
                )}
            </span>
          </div>
        </div>

        {/* ── Environment selector / CTA ── */}
        {hasEnvs && (
          <EnvSelector
            environments={[...environments]}
            activeEnvId={activeEnvId}
            currentPath={currentPath}
          />
        )}
        {!hasEnvs && (
          <div mix={s.envForm}>
            <a mix={s.ctaLink} href="/settings">Add environment →</a>
          </div>
        )}

        {/* ── Navigation ── */}
        <nav mix={s.scrollArea}>
          <div mix={s.sectionLabel}>Overview</div>
          <ul mix={s.navList}>{topItems.filter((i) => i.section === "overview").map(renderNavItem)}</ul>

          <div mix={s.sectionLabel}>Cluster</div>
          <ul mix={s.navList}>{topItems.filter((i) => i.section === "cluster").map(renderNavItem)}</ul>

          <div mix={s.sectionLabel}>Workflows</div>
          <ul mix={s.navList}>{topItems.filter((i) => i.section === "workflows").map(renderNavItem)}</ul>
        </nav>

        {/* ── Bottom pinned items ── */}
        <div mix={s.bottomSection}>
          <ul mix={s.navList}>{bottomItems.map(renderNavItem)}</ul>
        </div>
      </aside>
    )
  }
}
