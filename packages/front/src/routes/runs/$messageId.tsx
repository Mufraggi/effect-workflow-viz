import { RunDetailView } from "@/components/runs/run-detail/index"
import { RunsSidebar } from "@/components/runs/runs-sidebar"
import { type RunsSearch, validateRunsSearch } from "@/lib/runs-search"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import type { MessageId } from "@template/domain/run/MessageId"

export const Route = createFileRoute("/runs/$messageId")({
  validateSearch: (search) => validateRunsSearch(search as Record<string, unknown>),
  component: RunDetailRoute
})

function RunDetailRoute() {
  const { messageId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <div className="flex h-[calc(100vh-49px)]">
      <RunsSidebar
        filters={search}
        onFiltersChange={(next: RunsSearch) =>
          navigate({
            to: "/runs/$messageId",
            params: { messageId },
            search: next,
            replace: true
          })}
        selectedId={messageId as MessageId}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-8">
          <RunDetailView messageId={messageId as MessageId} />
        </div>
      </main>
    </div>
  )
}
