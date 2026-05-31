import { css, type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { routes } from "../routes.js"
import { FONTS_HREF, tk } from "../ui/tokens.js"
import { authStyles as a } from "./auth-styles.js"

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

export interface SettingsPageProps {
  email: string
  role: string
  isAdmin: boolean
  users: ReadonlyArray<SettingsUser>
  activity: ReadonlyArray<ActivityEntry>
  error: string | null
  success: string | null
}

const s = {
  container: css({ maxWidth: "48rem", margin: "0 auto", padding: "2.5rem 2rem" }),
  back: css({
    fontSize: ".85rem",
    display: "inline-block",
    marginBottom: "1.25rem",
    color: tk.primary,
    fontWeight: 500,
    textDecoration: "none",
    "&:hover": { textDecoration: "underline" }
  }),
  h1: css({
    margin: "0 0 1.5rem",
    fontFamily: tk.fontSerif,
    fontSize: "1.9rem",
    fontWeight: 600,
    letterSpacing: "-.01em"
  }),
  card: css({
    background: tk.card,
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radius,
    padding: "1.5rem",
    margin: "0 0 1.5rem"
  }),
  cardTitle: css({
    fontSize: ".72rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "0 0 1rem"
  }),
  row: css({ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".35rem 0" }),
  key: css({ color: tk.mutedFg, fontSize: ".9rem" }),
  val: css({ fontFamily: tk.fontMono, fontSize: ".85rem" }),
  userRow: css({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: ".5rem",
    padding: ".6rem 0",
    borderTop: `1px solid ${tk.border}`
  }),
  userEmail: css({ fontFamily: tk.fontMono, fontSize: ".85rem", flex: "1 1 12rem", wordBreak: "break-all" }),
  small: css({
    padding: ".35rem .5rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".8rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  btnSm: css({
    padding: ".35rem .7rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".8rem",
    fontWeight: 500,
    cursor: "pointer",
    "&:hover": { background: tk.hoverBg }
  }),
  btnDanger: css({
    border: `1px solid ${tk.destructive}`,
    color: tk.destructive,
    "&:hover": { background: "color-mix(in oklch, oklch(0.6368 0.2078 25.3313) 12%, transparent)" }
  }),
  roleTag: css({
    fontSize: ".7rem",
    fontFamily: tk.fontMono,
    textTransform: "uppercase",
    letterSpacing: ".05em",
    padding: ".15rem .5rem",
    borderRadius: "999px",
    color: tk.primary,
    background: tk.primarySoft
  }),
  createTitle: css({
    fontSize: ".72rem",
    textTransform: "uppercase",
    letterSpacing: ".05em",
    color: tk.mutedFg,
    margin: "1.5rem 0 0"
  }),
  form: css({ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end", marginTop: "1rem" }),
  field: css({ display: "flex", flexDirection: "column", gap: ".4rem" }),
  lbl: css({ fontSize: ".7rem", textTransform: "uppercase", letterSpacing: ".05em", color: tk.mutedFg }),
  input: css({
    padding: ".5rem .65rem",
    border: `1px solid ${tk.border}`,
    borderRadius: tk.radiusSm,
    background: tk.bg,
    color: "inherit",
    font: "inherit",
    fontSize: ".85rem",
    minWidth: "12rem",
    "&:focus": { outline: "none", borderColor: tk.primary }
  }),
  ok: css({
    padding: ".6rem .8rem",
    borderRadius: tk.radiusSm,
    fontSize: ".85rem",
    margin: "0 0 1.5rem",
    color: "#15803d",
    border: "1px solid #15803d",
    background: "color-mix(in oklch, #15803d 10%, transparent)"
  }),
  lastLogin: css({ fontSize: ".72rem", color: tk.mutedFg, fontFamily: tk.fontMono, flexBasis: "100%" }),
  actRow: css({
    display: "flex",
    flexWrap: "wrap",
    gap: ".5rem 1rem",
    alignItems: "baseline",
    padding: ".45rem 0",
    borderTop: `1px solid ${tk.border}`,
    fontSize: ".8rem"
  }),
  actEvent: css({ fontFamily: tk.fontMono, minWidth: "9rem" }),
  actMeta: css({ color: tk.mutedFg, fontFamily: tk.fontMono }),
  actAt: css({ color: tk.mutedFg, marginLeft: "auto", fontFamily: tk.fontMono })
}

/** Configuration page: account info, logout, user list, and admin account creation. */
export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    const { activity, email, error, isAdmin, role, success, users } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Settings</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={a.body}>
          <main mix={s.container}>
            <a mix={s.back} href={routes.home.href()}>← Back to runs</a>
            <h1 mix={s.h1}>Settings</h1>

            {success !== null && <div mix={s.ok}>{success}</div>}
            {error !== null && <div mix={a.error}>{error}</div>}

            <section mix={s.card}>
              <h2 mix={s.cardTitle}>Account</h2>
              <div mix={s.row}>
                <span mix={s.key}>Email</span>
                <span mix={s.val}>{email}</span>
              </div>
              <div mix={s.row}>
                <span mix={s.key}>Role</span>
                <span mix={s.val}>{role}</span>
              </div>
            </section>

            <section mix={s.card}>
              <h2 mix={s.cardTitle}>Session</h2>
              <form method="post" action={routes.logout.href()}>
                <button mix={[a.btn, a.btnPrimary]} type="submit">Log out</button>
              </form>
            </section>

            <section mix={s.card}>
              <h2 mix={s.cardTitle}>Users</h2>
              {users.map((u) =>
                isAdmin
                  ? (
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
                  )
                  : (
                    <div mix={s.userRow}>
                      <span mix={s.userEmail}>{u.email}</span>
                      <span mix={s.roleTag}>{u.role}</span>
                    </div>
                  )
              )}

              {isAdmin
                ? (
                  <div>
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
                )
                : <p mix={s.key}>Only admins can manage accounts.</p>}
            </section>

            {isAdmin && (
              <section mix={s.card}>
                <h2 mix={s.cardTitle}>Recent activity</h2>
                {activity.length === 0
                  ? <p mix={s.key}>No activity recorded yet.</p>
                  : activity.map((e) => (
                    <div mix={s.actRow}>
                      <span mix={s.actEvent}>{e.event}</span>
                      <span mix={s.actMeta}>{e.email ?? "—"}{e.ip !== null ? ` · ${e.ip}` : ""}</span>
                      <span mix={s.actAt}>{e.at}</span>
                    </div>
                  ))}
              </section>
            )}
          </main>
        </body>
      </html>
    )
  }
}
