import { createRootRoute, Link, Outlet } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools"

export const Route = createRootRoute({
  component: RootComponent
})

function RootComponent() {
  return (
    <>
      <nav className="flex gap-4 px-6 py-3 border-b border-border bg-card text-sm">
        <Link
          to="/"
          className="text-foreground hover:text-primary transition"
          activeProps={{ className: "text-primary font-semibold" }}
          activeOptions={{ exact: true }}
        >
          Runs
        </Link>
        <Link
          to="/about"
          className="text-foreground hover:text-primary transition"
          activeProps={{ className: "text-primary font-semibold" }}
        >
          About
        </Link>
      </nav>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}
