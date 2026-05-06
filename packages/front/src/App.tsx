import { AtomHttpApi, Result, useAtomValue } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { Api } from "@template/api-contract"

class ApiClient extends AtomHttpApi.Tag<ApiClient>()("ApiClient", {
  api: Api,
  httpClient: FetchHttpClient.layer,
  baseUrl: "http://localhost:3000"
}) {}

export const App = () => {
  const ping = useAtomValue(
    ApiClient.query("health", "ping", { reactivityKeys: ["health.ping"] })
  )

  const status = Result.matchWithError(ping, {
    onInitial: () => "loading…",
    onError: (e) => `error: ${String(e)}`,
    onDefect: (d) => `defect: ${String(d)}`,
    onSuccess: (s) => `ok: ${JSON.stringify(s.value)}`
  })

  return (
    <main className="min-h-[calc(100vh-4rem)] p-8 flex items-center justify-center">
      <div className="bg-card text-card-foreground rounded-2xl shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-serif font-semibold mb-4">effect-workflow-viz</h1>
        <p className="text-muted-foreground mb-6">API health: {status}</p>
        <div className="flex gap-3">
          <button className="bg-primary text-primary-foreground rounded-xl px-4 py-2 shadow-md hover:opacity-90 transition">
            Primary
          </button>
          <button className="bg-secondary text-secondary-foreground rounded-xl px-4 py-2 shadow-md hover:opacity-90 transition">
            Secondary
          </button>
          <button className="bg-accent text-accent-foreground rounded-xl px-4 py-2 shadow-md hover:opacity-90 transition">
            Accent
          </button>
        </div>
      </div>
    </main>
  )
}
