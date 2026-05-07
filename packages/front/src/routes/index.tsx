import { createFileRoute } from "@tanstack/react-router"
import { RunsPage } from "@/components/runs/runs-page"

export const Route = createFileRoute("/")({
  component: RunsPage
})
