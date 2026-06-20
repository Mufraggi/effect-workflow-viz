import { get, route } from "remix/routes"

/**
 * The URL contract — single source of truth for the app's routes.
 *
 * Every internal link, redirect, and fetch URL is built from `routes.<name>.href(...)`
 * so URLs stay coupled to this definition (no hard-coded path strings elsewhere).
 *
 * All entries are direct leaves of the root map, so a single root controller
 * (`app/actions/controller.tsx`) owns every action.
 */
export const routes = route({
  // Compiled client assets (TS/TSX) served on demand.
  assets: get("/assets/*path"),
  // First-run admin creation flow + login/logout (public; method-branched).
  setup: "/setup",
  login: "/login",
  logout: "/logout",
  // Configuration page (account info, logout; account creation later).
  settings: "/settings",
  // Server-rendered Runs list; the table hydrates for "Load more".
  home: "/",
  // Server-rendered scatter (start time × duration, colored by status); the Chart.js canvas hydrates.
  chart: "/chart",
  // Paginated list as JSON; consumed by the hydrated "Load more".
  runs: get("/runs"),
  // Server-rendered run detail page.
  runShow: "/runs/:messageId",
  // Sibling runs sharing the trace, as JSON.
  runChildren: get("/runs/:messageId/children"),
  // API endpoint for environment CRUD.
  environments: get("/environments"),
  // API endpoint — switch active environment (stored in session).
  selectEnv: get("/select-env"),
  // Cluster Overview page with live SSE streaming.
  overview: "/overview",
  // SSE endpoint for live overview snapshots.
  overviewStream: get("/overview/stream"),
  // Dedicated Nodes page — runners status, shards per node.
  nodes: "/nodes",
  // Dedicated Shards page — dense heatmap + nodes.
  shards: "/shards",
  // Read-only workflow executions list.
  executions: "/executions",
  // Read-only detail for a single execution, keyed by executionId (entity_id).
  executionShow: "/executions/:executionId"
})
