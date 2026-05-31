import { type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { routes } from "../routes.js"
import { FONTS_HREF } from "../ui/tokens.js"
import { authStyles as s } from "./auth-styles.js"

export interface SetupPageProps {
  error: string | null
}

/**
 * First-run admin creation form. Shown only while the auth DB has no accounts;
 * submitting creates the admin and signs them in. No client JS.
 */
export function SetupPage(handle: Handle<SetupPageProps>) {
  return () => {
    const { error } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Create admin account</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={s.body}>
          <main mix={s.shell}>
            <form mix={s.card} method="post" action={routes.setup.href()}>
              <span mix={s.badge}>First-time setup</span>
              <h1 mix={s.h1}>Create admin account</h1>
              <p mix={s.muted}>This one-time step provisions the administrator for this instance.</p>

              {error !== null && <div mix={s.error}>{error}</div>}

              <label mix={s.field}>
                <span mix={s.lbl}>Email</span>
                <input mix={s.input} type="email" name="email" autocomplete="username" required />
              </label>

              <label mix={s.field}>
                <span mix={s.lbl}>Password</span>
                <input
                  mix={s.input}
                  type="password"
                  name="password"
                  autocomplete="new-password"
                  minlength={8}
                  required
                />
                <span mix={s.hint}>At least 8 characters.</span>
              </label>

              <button mix={[s.btn, s.btnPrimary]} type="submit">Create account</button>
            </form>
          </main>
        </body>
      </html>
    )
  }
}
