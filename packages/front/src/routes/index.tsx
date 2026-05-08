import { RunsPage } from "@/components/runs/runs-page"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  component: RunsPage
})
