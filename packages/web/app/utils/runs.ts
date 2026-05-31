import type { Paginated } from "@template/domain/Pagination"
import type { RunSummary } from "@template/domain/run/RunSummary"
import type { Schema } from "effect"

// The encoded (JSON-safe) shape of a paginated run list — what the loader hands
// to components (e.g. `startedAtProxy` is a string here, not a Date).
type PaginatedRunsEncoded = Schema.Schema.Encoded<
  ReturnType<typeof Paginated<RunSummary, typeof RunSummary.Encoded, never>>
>
export type RunSummaryEncoded = PaginatedRunsEncoded["items"][number]

export interface RunsFilters {
  status: ReadonlyArray<string>
  workflowName: string | null
  traceId: string | null
}

/** Serialize active filters to a query string (no leading "?", no cursor). */
export const buildFilterQuery = (filters: RunsFilters): string => {
  const sp = new URLSearchParams()
  for (const s of filters.status) sp.append("status", s)
  if (filters.workflowName !== null) sp.set("workflowName", filters.workflowName)
  if (filters.traceId !== null) sp.set("traceId", filters.traceId)
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
