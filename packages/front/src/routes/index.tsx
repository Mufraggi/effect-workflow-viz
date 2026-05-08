import { RunsPage } from "@/components/runs/runs-page"
import { type RunsSearch, validateRunsSearch } from "@/lib/runs-search"
import { createFileRoute, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  validateSearch: (search) => validateRunsSearch(search as Record<string, unknown>),
  component: IndexComponent
})

function IndexComponent() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  return (
    <RunsPage
      filters={search}
      onFiltersChange={(next: RunsSearch) => navigate({ to: "/", search: next, replace: true })}
    />
  )
}
