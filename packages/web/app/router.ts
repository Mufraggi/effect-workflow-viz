import { createRouter, type MiddlewareContext } from "remix/router"
import rootController from "./actions/controller.js"
import { render } from "./middleware/render.js"
import { routes } from "./routes.js"

// The app context is derived from the root middleware stack so controller
// actions get a typed `render(...)` (installed by the render middleware).
type AppContext = MiddlewareContext<[ReturnType<typeof render>]>

declare module "remix/router" {
  interface RouterTypes {
    context: AppContext
  }
}

export const router = createRouter<AppContext>({ middleware: [render()] })

// Every route is a direct leaf of the root map, so one controller owns them all.
router.map(routes, rootController)
