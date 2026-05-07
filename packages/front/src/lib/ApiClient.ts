import { AtomHttpApi } from "@effect-atom/atom-react"
import { FetchHttpClient } from "@effect/platform"
import { Api } from "@template/api-contract/Api"

export class ApiClient extends AtomHttpApi.Tag<ApiClient>()("ApiClient", {
  api: Api,
  httpClient: FetchHttpClient.layer,
  baseUrl: "http://localhost:3000"
}) {}
