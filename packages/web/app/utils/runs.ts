import type { Paginated } from "@template/domain/Pagination"
import type { RunSummary } from "@template/domain/run/RunSummary"
import type { Schema } from "effect"

// The encoded (JSON-safe) shape of a paginated run list — what the loader hands
// to components (e.g. `startedAt` is an ISO string here, not a Date).
type PaginatedRunsEncoded = Schema.Schema.Encoded<
  ReturnType<typeof Paginated<RunSummary, typeof RunSummary.Encoded, never>>
>
export type RunSummaryEncoded = PaginatedRunsEncoded["items"][number]

export interface RunsFilters {
  status: ReadonlyArray<string>
  workflowName: string | null
  traceId: string | null
  // ISO 8601 strings (UTC); the start-time range bounds, shared by list + chart.
  from: string | null
  to: string | null
}

/** Serialize active filters to a query string (no leading "?", no cursor). */
export const buildFilterQuery = (filters: RunsFilters): string => {
  const sp = new URLSearchParams()
  for (const s of filters.status) sp.append("status", s)
  if (filters.workflowName !== null) sp.set("workflowName", filters.workflowName)
  if (filters.traceId !== null) sp.set("traceId", filters.traceId)
  if (filters.from !== null) sp.set("from", filters.from)
  if (filters.to !== null) sp.set("to", filters.to)
  return sp.toString()
}

/**
 * Deterministic UTC date format — identical on server and client to avoid
 * hydration drift, and shared by both the (hydrated) list and the detail page.
 * Accepts an ISO string and renders `YYYY-MM-DD HH:MM:SS`.
 */
export const fmtDate = (value: string | null): string => {
  if (value === null) return "—"
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value)
  return m === null ? value : `${m[1]} ${m[2]}`
}

/** Human-readable run duration; "—" when unknown (no reply yet). */
export const fmtDuration = (ms: number | null): string => {
  if (ms === null) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}
