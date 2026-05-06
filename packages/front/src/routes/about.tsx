import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: AboutComponent
})

function AboutComponent() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-serif font-semibold mb-4">About</h1>
      <p className="text-muted-foreground">effect-workflow-viz frontend.</p>
    </main>
  )
}
