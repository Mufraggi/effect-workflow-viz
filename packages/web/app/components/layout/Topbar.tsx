import { css, type Handle, type RemixNode } from "remix/ui"
import { routes } from "../../routes.js"
import { tk } from "../../ui/tokens.js"

// ---------------------------------------------------------------------------
// Inline SVG wrapper
// ---------------------------------------------------------------------------

function Svg(handle: Handle<{ viewBox?: string; width?: string; height?: string; children: RemixNode }>) {
  return () => {
    const { children, height = "18", viewBox = "0 0 24 24", width = "18" } = handle.props
    return (
      <svg
        width={width}
        height={height}
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
// Icons
// ---------------------------------------------------------------------------

function IconSearch() {
  return () => (
    <Svg>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </Svg>
  )
}

function IconRefresh() {
  return () => (
    <Svg width="16" height="16">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
    </Svg>
  )
}

function IconBell() {
  return () => (
    <Svg width="16" height="16">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </Svg>
  )
}

function IconGear() {
  return () => (
    <Svg width="16" height="16">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.32 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Svg>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
  topbar: css({
    height: tk.topbarHeight,
    minHeight: tk.topbarHeight,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0 1.5rem",
    background: tk.topbarBg,
    borderBottom: `1px solid ${tk.borderLight}`
  }),
  left: css({
    display: "flex",
    alignItems: "center",
    flex: 1,
    minWidth: 0
  }),
  searchWrapper: css({
    position: "relative",
    width: "100%",
    maxWidth: "28rem"
  }),
  searchIcon: css({
    position: "absolute",
    left: ".625rem",
    top: "50%",
    transform: "translateY(-50%)",
    color: tk.dimmedFg,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center"
  }),
  searchInput: css({
    width: "100%",
    padding: ".45rem .75rem .45rem 2.125rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: tk.fg,
    fontFamily: tk.fontSans,
    fontSize: ".82rem",
    lineHeight: 1.4,
    outline: "none",
    transition: "border-color 0.15s",
    "::placeholder": { color: tk.dimmedFg },
    "&:focus": { borderColor: tk.primary }
  }),
  right: css({
    display: "flex",
    alignItems: "center",
    gap: ".75rem",
    flexShrink: 0
  }),
  badge: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".35rem",
    padding: ".2rem .55rem",
    borderRadius: "999px",
    fontSize: ".72rem",
    fontWeight: 600,
    fontFamily: tk.fontMono,
    color: tk.success,
    background: tk.successSoft,
    whiteSpace: "nowrap"
  }),
  liveIndicator: css({
    display: "inline-flex",
    alignItems: "center",
    gap: ".35rem",
    fontSize: ".75rem",
    fontWeight: 600,
    color: tk.success
  }),
  liveIndicatorOff: css({
    color: tk.dimmedFg
  }),
  liveDot: css({
    width: ".4rem",
    height: ".4rem",
    borderRadius: "50%",
    background: tk.success,
    flexShrink: 0
  }),
  liveDotOff: css({
    background: tk.dimmedFg
  }),
  updateTime: css({
    fontSize: ".75rem",
    color: tk.dimmedFg,
    fontFamily: tk.fontMono,
    whiteSpace: "nowrap"
  }),
  iconBtn: css({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "2rem",
    height: "2rem",
    borderRadius: tk.radiusSm,
    border: "none",
    background: "transparent",
    color: tk.mutedFg,
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    "&:hover": {
      background: tk.hoverBg,
      color: tk.fg
    }
  })
}

// ---------------------------------------------------------------------------
// Topbar component
// ---------------------------------------------------------------------------

export function Topbar(
  handle: Handle<{
    currentEnvName?: string | null
    isLive?: boolean
  }>
) {
  return () => {
    const { currentEnvName, isLive = false } = handle.props
    const now = new Date()
    const time = now.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })

    return (
      <header mix={s.topbar}>
        {/* Left: Search */}
        <div mix={s.left}>
          <div mix={s.searchWrapper}>
            <span mix={s.searchIcon}>
              <IconSearch />
            </span>
            <input
              mix={s.searchInput}
              type="search"
              placeholder="Search workflows, activities, or execution IDs..."
            />
          </div>
        </div>

        {/* Right: Status + actions */}
        <div mix={s.right}>
          {currentEnvName && <span mix={s.badge}>{currentEnvName}</span>}

          {
            /* Live status — server renders the env-based default; on the
              Overview page the client entry updates these nodes by id to
              reflect the real SSE connection state. */
          }
          <span id="topbar-live" mix={[s.liveIndicator, !isLive ? s.liveIndicatorOff : null]}>
            <span id="topbar-live-dot" mix={[s.liveDot, !isLive ? s.liveDotOff : null]} />
            <span id="topbar-live-label">{isLive ? "Live" : "Offline"}</span>
          </span>

          <span id="topbar-live-time" mix={s.updateTime}>{isLive ? `Updated ${time}` : ""}</span>

          <button mix={s.iconBtn} title="Refresh" aria-label="Refresh">
            <IconRefresh />
          </button>
          <button mix={s.iconBtn} title="Notifications" aria-label="Notifications">
            <IconBell />
          </button>
          <a mix={s.iconBtn} href={routes.settings.href()} title="Settings" aria-label="Settings">
            <IconGear />
          </a>
        </div>
      </header>
    )
  }
}
