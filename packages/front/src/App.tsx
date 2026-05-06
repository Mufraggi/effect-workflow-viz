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
    <main>
      <h1>effect-workflow-viz</h1>
      <p>API health: {status}</p>
    </main>
  )
}
