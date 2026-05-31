import { Schema } from "effect"

const isValidIpv4 = (s: string): boolean => {
  const parts = s.split(".")
  if (parts.length !== 4) return false
  return parts.every((p) => {
    const n = Number(p)
    return Number.isInteger(n) && n >= 0 && n <= 255 && p === String(n)
  })
}

const isValidIpv6 = (s: string): boolean => /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(s)

/** A validated IPv4 or IPv6 address, used to key login-attempt rate limiting. */
export const IpAddress = Schema.String.pipe(
  Schema.filter((s) => isValidIpv4(s) || isValidIpv6(s), {
    identifier: "IpAddress",
    message: () => "Invalid IPv4 or IPv6 address"
  }),
  Schema.brand("IpAddress")
)
export type IpAddress = typeof IpAddress.Type
