import { css, type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { routes } from "../routes.js"
import { FONTS_HREF, tk } from "../ui/tokens.js"
import { authStyles as a } from "./auth-styles.js"

export interface SettingsPageProps {
  email: string
  role: string
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
  h1: css({ margin: "0 0 1.5rem", fontFamily: tk.fontSerif, fontSize: "1.9rem", fontWeight: 600, letterSpacing: "-.01em" }),
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
  soon: css({ color: tk.mutedFg, fontSize: ".85rem", fontStyle: "italic" })
}

/** Configuration page: account info + logout. Account creation lands here later. */
export function SettingsPage(handle: Handle<SettingsPageProps>) {
  return () => {
    const { email, role } = handle.props
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
              <p mix={s.soon}>Account creation will be available here.</p>
            </section>
          </main>
        </body>
      </html>
    )
  }
}
