import { formData } from "remix/middleware/form-data"
import { session } from "remix/middleware/session"
import { createRouter, type MiddlewareContext } from "remix/router"
import rootController from "./actions/controller.js"
import { sessionCookie } from "./auth/cookie.js"
import { loadAuth } from "./auth/scheme.js"
import { sessionStorage } from "./auth/session.js"
import { render } from "./middleware/render.js"
import { routes } from "./routes.js"

// Root middleware stack (order matters):
//  - formData(): parse request bodies so login/setup POSTs can read fields
//  - session(): load/persist the signed session cookie  (must precede auth)
//  - loadAuth(): resolve `context.auth` from the session via the auth scheme
//  - render(): install the typed `context.render(...)`
const middleware = [
  formData(),
  session(sessionCookie, sessionStorage),
  loadAuth(),
  render()
] as const

// The app context is derived from the root middleware stack so controller
// actions get typed `render(...)`, `session`, `auth`, and `formData`.
type AppContext = MiddlewareContext<[...typeof middleware]>

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: [...middleware] })

// Every route is a direct leaf of the root map, so one controller owns them all.
router.map(routes, rootController)
