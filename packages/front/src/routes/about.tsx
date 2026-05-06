import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/about")({
  component: AboutComponent
})

function AboutComponent() {
  return (
    <main style={{ padding: "1rem" }}>
      <h1>About</h1>
      <p>effect-workflow-viz frontend.</p>
    </main>
  )
}
