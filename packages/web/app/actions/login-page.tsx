import { type Handle } from "remix/ui"
import { RMX_01 } from "remix/ui/theme"
import { routes } from "../routes.js"
import { FONTS_HREF } from "../ui/tokens.js"
import { authStyles as s } from "./auth-styles.js"

export interface LoginPageProps {
  error: string | null
  returnTo: string | null
}

/** Server-rendered login form. No client JS — a plain POST to `/login`. */
export function LoginPage(handle: Handle<LoginPageProps>) {
  return () => {
    const { error, returnTo } = handle.props
    return (
      <html lang="en">
        <head>
          <meta charSet="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Sign in</title>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link rel="stylesheet" href={FONTS_HREF} />
          <RMX_01 />
        </head>
        <body mix={s.body}>
          <main mix={s.shell}>
            <form mix={s.card} method="post" action={routes.login.href()}>
              <h1 mix={s.h1}>Sign in</h1>
              <p mix={s.muted}>Enter your credentials to access the workflow runs.</p>

              {error !== null && <div mix={s.error}>{error}</div>}

              {returnTo !== null && <input type="hidden" name="returnTo" value={returnTo} />}

              <label mix={s.field}>
                <span mix={s.lbl}>Email</span>
                <input mix={s.input} type="email" name="email" autocomplete="username" required />
              </label>

              <label mix={s.field}>
                <span mix={s.lbl}>Password</span>
                <input mix={s.input} type="password" name="password" autocomplete="current-password" required />
              </label>

              <button mix={[s.btn, s.btnPrimary]} type="submit">Sign in</button>
            </form>
          </main>
        </body>
      </html>
    )
  }
}
