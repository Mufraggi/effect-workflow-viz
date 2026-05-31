import { createCookieSessionStorage } from "remix/session-storage/cookie"

/**
 * Stateless session storage: the (signed) cookie carries the whole session.
 * No server-side table or volume to manage — the payload is just `{ userId }`,
 * well under the ~4 KB cookie limit.
 */
export const sessionStorage = createCookieSessionStorage()
