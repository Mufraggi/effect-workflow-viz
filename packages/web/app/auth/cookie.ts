import { createCookie } from "remix/cookie"

const isProd = process.env.NODE_ENV === "production"
const secret = process.env.SESSION_SECRET

// Fail fast in production: an unsigned/known-secret session cookie is a security
// hole. In dev we fall back to a fixed secret so the app boots without setup.
if (isProd && (secret === undefined || secret.length === 0)) {
  throw new Error("SESSION_SECRET must be set in production")
}

/**
 * The signed cookie backing the session. Data lives in the cookie itself
 * (stateless — see `./session.ts`), so it is HMAC-signed and HTTP-only.
 */
export const sessionCookie = createCookie("__session", {
  secrets: [secret ?? "dev-only-insecure-secret"],
  httpOnly: true,
  sameSite: "Lax",
  secure: isProd,
  maxAge: 60 * 60 * 24 * 30,
  path: "/"
})
