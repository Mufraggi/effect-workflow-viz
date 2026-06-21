import { css, type Handle } from "remix/ui"
import { AppLayout } from "../components/layout/AppLayout.js"
import { routes } from "../routes.js"
import { authStyles as a } from "../ui/auth-styles.js"
import { tk } from "../ui/tokens.js"

export interface SettingsUser {
  id: string
  email: string
  role: string
  lastLoginAt: string | null
  canDelete: boolean
}

export interface ActivityEntry {
  event: string
  email: string | null
  ip: string | null
  at: string
}

export interface EnvironmentEntry {
  id: string
  name: string
  host: string
  port: string
  user: string
  dbName: string
  ssl: boolean
  isDefault: boolean
}

export interface ApiKeyEntry {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

export interface SettingsPageProps {
  email: string
  role: string
  isAdmin: boolean
  users: ReadonlyArray<SettingsUser>
  activity: ReadonlyArray<ActivityEntry>
  environments: ReadonlyArray<EnvironmentEntry>
  apiKeys: ReadonlyArray<ApiKeyEntry>
  activeEnvId: string | null
  createdKey?: string
  createdKeyName?: string
  tab: string
  error: string | null
  success: string | null
}

// ── Shared styles ──────────────────────────────────────────────────────────

const s = {
  container: css({ maxWidth: "48rem", margin: "0 auto", padding: "2rem 2rem 3rem" }),
  back: css({
    fontSize: ".82rem",
    display: "inline-block",
    marginBottom: "1rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  h1: css({
    margin: "0 0 1.25rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.75rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1.5rem"
  }),
  cardTitle: css({
    fontSize: ".68rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "0 0 1rem"
  }),
  row: css({ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".35rem 0" }),
  key: css({ color: tk.mutedFg, fontSize: ".85rem" }),
  val: css({ fontFamily: tk.fontMono, fontSize: ".82rem" }),
  ok: css({
    padding: ".6rem .8rem",
    borderRadius: tk.radiusSm,
    fontSize: ".85rem",
    marginBottom: "1.25rem",
    color: tk.success,
    border: `1px solid ${tk.success}`,
    background: tk.successSoft
  }),
  emptyText: css({ color: tk.mutedFg, fontSize: ".85rem", margin: 0 }),

  // ── Tab bar ────────────────────────────────────────────────────────────
  tabBar: css({
    display: "flex",
    gap: ".125rem",
    marginBottom: "1.5rem",
    borderBottom: `1px solid ${tk.borderLight}`,
    paddingBottom: 0
  }),
  tab: css({
    padding: ".55rem 1rem",
    fontSize: ".82rem",
    fontWeight: 500,
    color: tk.mutedFg,
    textDecoration: "none",
    borderBottom: `2px solid transparent`,
    marginBottom: "-1px",
    transition: "color 0.12s, border-color 0.12s",
    "&:hover": { color: tk.fg }
  }),
  tabActive: css({
    color: tk.primary,
    borderBottomColor: tk.primary,
    "&:hover": { color: tk.primary }
  }),

  // ── Users tab ──────────────────────────────────────────────────────────
  userRow: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: ".5rem",
    padding: ".6rem 0",
    borderTop: `1px solid ${tk.border}`
  }),
  userEmail: css({ fontFamily: tk.fontMono, fontSize: ".82rem", flex: "1 1 12rem", wordBreak: "break-all" }),
  small: css({
    padding: ".3rem .45rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: tk.fg,
    font: "inherit",
    fontSize: ".78rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  btnSm: css({
    padding: ".3rem .65rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: tk.mutedFg,
    font: "inherit",
    fontSize: ".78rem",
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { background: tk.hoverBg, color: tk.fg }
  }),
  btnDanger: css({
    border: `1px solid ${tk.destructive}`,
    color: tk.destructive,
    "&:hover": { background: tk.destructiveSoft }
  }),
  roleTag: css({
    fontSize: ".68rem",
    fontFamily: tk.fontMono,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    padding: ".15rem .45rem",
    borderRadius: "999px",
    color: tk.primary,
    background: tk.primarySoft
  }),
  lastLogin: css({ fontSize: ".7rem", color: tk.mutedFg, fontFamily: tk.fontMono, flexBasis: "100%" }),
  createTitle: css({
    fontSize: ".68rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "1.5rem 0 0"
  }),
  form: css({ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", marginTop: "1rem" }),
  field: css({ display: "flex", flexDirection: "column", gap: ".4rem" }),
  lbl: css({ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".05em", color: tk.mutedFg }),
  input: css({
    padding: ".45rem .6rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: tk.fg,
    font: "inherit",
    fontSize: ".82rem",
    minWidth: "12rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),

  // ── Activity tab ───────────────────────────────────────────────────────
  actRow: css({
    display: "flex",
    flexWrap: "wrap",
    gap: ".5rem 1rem",
    alignItems: "baseline",
    padding: ".45rem 0",
    borderTop: `1px solid ${tk.border}`,
    fontSize: ".78rem"
  }),
  actEvent: css({ fontFamily: tk.fontMono, minWidth: "9rem" }),
  actMeta: css({ color: tk.mutedFg, fontFamily: tk.fontMono }),
  actAt: css({ color: tk.mutedFg, marginLeft: "auto", fontFamily: tk.fontMono })
}

// ── Settings page ───────────────────────────────────────────────────────────

export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    const {
      activeEnvId,
      activity,
      apiKeys,
      createdKey,
      createdKeyName,
      email,
      environments,
      error,
      isAdmin,
      role,
      success,
      tab,
      users
    } = handle.props
    const envInfo = environments.map((e) => ({ id: e.id, name: e.name, isDefault: e.isDefault }))

    const tabLink = (id: string, label: string) => (
      <a mix={[s.tab, tab === id ? s.tabActive : null]} href={`?tab=${id}`}>{label}</a>
    )

    return (
      <AppLayout
        title="Settings — Workflow Viz"
        activeNav="settings"
        environments={envInfo}
        activeEnvId={activeEnvId}
      >
        <main mix={s.container}>
          <a mix={s.back} href={routes.home.href()}>← Back to runs</a>
          <h1 mix={s.h1}>Settings</h1>

          {success !== null && <div mix={s.ok}>{success}</div>}
          {error !== null && <div mix={a.error}>{error}</div>}

          {/* ── Tab bar ── */}
          <nav mix={s.tabBar}>
            {tabLink("account", "Account")}
            {isAdmin && tabLink("users", "Users")}
            {isAdmin && tabLink("environments", "Environments")}
            {tabLink("api-keys", "API Keys")}
            {isAdmin && tabLink("activity", "Activity")}
          </nav>

          {/* ── Account tab ── */}
          {tab === "account" && (
            <div mix={s.card}>
              <h2 mix={s.cardTitle}>Account</h2>
              <div mix={s.row}>
                <span mix={s.key}>Email</span>
                <span mix={s.val}>{email}</span>
              </div>
              <div mix={s.row}>
                <span mix={s.key}>Role</span>
                <span mix={s.val}>{role}</span>
              </div>
              <div style={{ marginTop: "1.5rem" }}>
                <h2 mix={s.cardTitle}>Session</h2>
                <form method="post" action={routes.logout.href()}>
                  <button mix={[a.btn, a.btnPrimary]} type="submit">Log out</button>
                </form>
              </div>
            </div>
          )}

          {/* ── Users tab (admin only) ── */}
          {tab === "users" && isAdmin && (
            <div mix={s.card}>
              <h2 mix={s.cardTitle}>Users</h2>
              <p mix={s.emptyText} style={{ marginBottom: ".75rem" }}>
                Manage accounts and roles. {users.length} user{users.length !== 1 ? "s" : ""} total.
              </p>

              {users.map((u) => (
                <form mix={s.userRow} method="post" action={routes.settings.href()}>
                  <input type="hidden" name="id" value={u.id} />
                  <span mix={s.userEmail}>{u.email}</span>
                  <select mix={s.small} name="role">
                    <option value="user" selected={u.role === "user"}>user</option>
                    <option value="admin" selected={u.role === "admin"}>admin</option>
                  </select>
                  <input
                    mix={s.small}
                    type="password"
                    name="password"
                    placeholder="new password"
                    autocomplete="new-password"
                  />
                  <button mix={s.btnSm} type="submit" name="intent" value="update">Save</button>
                  {u.canDelete && (
                    <button mix={[s.btnSm, s.btnDanger]} type="submit" name="intent" value="delete">Delete</button>
                  )}
                  <span mix={s.lastLogin}>last login: {u.lastLoginAt ?? "never"}</span>
                </form>
              ))}

              <h3 mix={s.createTitle}>Create account</h3>
              <form mix={s.form} method="post" action={routes.settings.href()}>
                <div mix={s.field}>
                  <span mix={s.lbl}>Email</span>
                  <input mix={s.input} type="email" name="email" autocomplete="off" required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Password</span>
                  <input
                    mix={s.input}
                    type="password"
                    name="password"
                    autocomplete="new-password"
                    minlength={8}
                    required
                  />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Role</span>
                  <select mix={s.input} name="role">
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </div>
                <button mix={[a.btn, a.btnPrimary]} type="submit" name="intent" value="create">
                  Create account
                </button>
              </form>
            </div>
          )}

          {/* ── Environments tab (admin only) ── */}
          {tab === "environments" && isAdmin && (
            <div mix={s.card}>
              <h2 mix={s.cardTitle}>Environments</h2>
              <p mix={s.emptyText} style={{ marginBottom: ".75rem" }}>
                Configure Postgres connection details. Use the sidebar switcher to activate one.
              </p>

              {environments.length === 0 && <p mix={s.emptyText}>No environments configured yet.</p>}

              {environments.map((env) => (
                <form method="post" action={routes.settings.href()}>
                  <input type="hidden" name="envId" value={env.id} />
                  <div mix={s.userRow}>
                    <span mix={s.userEmail}>{env.name}</span>
                    <span mix={s.key}>{env.host}:{env.port}/{env.dbName}</span>
                    {env.isDefault && <span mix={s.roleTag}>default</span>}
                    {!env.isDefault && (
                      <button mix={s.btnSm} type="submit" name="intent" value="set-default-env">
                        Make default
                      </button>
                    )}
                    <button mix={[s.btnSm, s.btnDanger]} type="submit" name="intent" value="delete-env">
                      Delete
                    </button>
                  </div>
                </form>
              ))}

              <h3 mix={s.createTitle}>Add environment</h3>
              <form mix={s.form} method="post" action={routes.settings.href()}>
                <input type="hidden" name="intent" value="create-env" />
                <div mix={s.field}>
                  <span mix={s.lbl}>Name</span>
                  <input mix={s.input} type="text" name="name" placeholder="Production" required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Host</span>
                  <input mix={s.input} type="text" name="host" placeholder="db.example.com" required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Port</span>
                  <input mix={s.input} type="text" name="port" placeholder="5432" />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>User</span>
                  <input mix={s.input} type="text" name="user" maxlength={63} required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Password</span>
                  <input mix={s.input} type="password" name="password" required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>Database</span>
                  <input mix={s.input} type="text" name="dbName" placeholder="cluster" required />
                </div>
                <div mix={s.field}>
                  <span mix={s.lbl}>SSL</span>
                  <select mix={s.small} name="ssl">
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div mix={s.field}>
                  <label mix={s.lbl}>
                    <input type="checkbox" name="isDefault" value="true" />
                    Set as default
                  </label>
                </div>
                <button mix={[a.btn, a.btnPrimary]} type="submit">
                  Add environment
                </button>
              </form>
            </div>
          )}

          {/* ── Activity tab (admin only) ── */}
          {/* ── API Keys tab ── */}
          {tab === "api-keys" && (
            <div mix={s.card}>
              <h2 mix={s.cardTitle}>API Keys</h2>
              <p mix={s.emptyText} style={{ marginBottom: ".75rem" }}>
                API keys allow programmatic access to the Effect Cluster via the MCP endpoint (port 3100). Keys are
                shown once at creation.
              </p>

              {apiKeys.length === 0 && <p mix={s.emptyText}>No API keys yet.</p>}

              {apiKeys.map((k) => (
                <div mix={s.userRow}>
                  <span mix={s.userEmail}>{k.name}</span>
                  <code mix={s.val} style={{ fontFamily: tk.fontMono, fontSize: ".82rem" }}>{k.keyPrefix}...</code>
                  <span mix={s.key}>created {k.createdAt}</span>
                  <span mix={s.key}>{k.lastUsedAt ? `last used ${k.lastUsedAt}` : "never used"}</span>
                  <form method="post" action={routes.settings.href()}>
                    <input type="hidden" name="keyId" value={k.id} />
                    <button mix={[s.btnSm, s.btnDanger]} type="submit" name="intent" value="revoke-key">Revoke</button>
                  </form>
                </div>
              ))}

              {createdKey && (
                <div mix={s.ok} style={{ margin: "1rem 0", wordBreak: "break-all" }}>
                  <strong>{createdKeyName ?? "Key"}:</strong> {createdKey}
                </div>
              )}

              <h3 mix={s.createTitle}>Create new key</h3>
              <form mix={s.form} method="post" action={routes.settings.href()}>
                <div mix={s.field}>
                  <span mix={s.lbl}>Name</span>
                  <input
                    mix={s.input}
                    type="text"
                    name="name"
                    placeholder="CI/CD"
                    maxlength={100}
                    minlength={1}
                    required
                  />
                </div>
                <button mix={[a.btn, a.btnPrimary]} type="submit" name="intent" value="create-key">
                  Create key
                </button>
              </form>
            </div>
          )}

          {tab === "activity" && isAdmin && (
            <div mix={s.card}>
              <h2 mix={s.cardTitle}>Recent activity</h2>
              {activity.length === 0
                ? <p mix={s.emptyText}>No activity recorded yet.</p>
                : activity.map((e) => (
                  <div mix={s.actRow}>
                    <span mix={s.actEvent}>{e.event}</span>
                    <span mix={s.actMeta}>{e.email ?? "—"}{e.ip !== null ? ` · ${e.ip}` : ""}</span>
                    <span mix={s.actAt}>{e.at}</span>
                  </div>
                ))}
            </div>
          )}
        </main>
      </AppLayout>
    )
  }
}
