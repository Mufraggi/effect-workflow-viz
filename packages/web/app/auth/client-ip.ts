import { IpAddress } from "@template/domain/auth/IpAddress"
import { Schema } from "effect"

/**
 * Socket address per request, populated by `server.ts` from the Node connection.
 * Keyed by the exact Request object the router dispatches (`context.request`).
 */
export const clientAddresses = new WeakMap<Request, string>()

const decodeIp = Schema.decodeUnknownOption(IpAddress)
const normalize = (s: string): string => (s.startsWith("::ffff:") ? s.slice(7) : s)

/**
 * Resolve the client IP for rate limiting / audit. Prefers proxy headers
 * (`x-forwarded-for`, `x-real-ip`) — set these on your reverse proxy in
 * production — then falls back to the raw socket address. `null` when unknown
 * (rate limiting is simply skipped in that case).
 */
export function resolveClientIp(request: Request): IpAddress | null {
  const candidates = [
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    request.headers.get("x-real-ip")?.trim(),
    clientAddresses.get(request)
  ]
  for (const c of candidates) {
    if (c === undefined || c === "") continue
    const ip = decodeIp(normalize(c))
    if (ip._tag === "Some") return ip.value
  }
  return null
}
