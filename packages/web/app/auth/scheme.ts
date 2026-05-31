import { AuthRepository } from "@template/auth/AuthRepository"
import { User } from "@template/domain/auth/User"
import { UserId } from "@template/domain/UserId"
import { Effect } from "effect"
import { auth, createSessionAuthScheme } from "remix/middleware/auth"
import { runtime } from "../data/runtime.js"

/** The auth record we persist in the session — just the user id. */
interface AuthRecord {
  readonly userId: string
}

/**
 * Resolves the logged-in `User` from the session record on every request, by
 * re-reading it from the auth SQLite DB (cheap local lookup). Going through the
 * Effect runtime keeps the repository the single source of truth — no
 * `remix/data-table` involved.
 */
const sessionScheme = createSessionAuthScheme<User, AuthRecord>({
  read(session) {
    return (session.get("auth") as AuthRecord | undefined) ?? null
  },
  verify(value) {
    return runtime.runPromise(
      Effect.gen(function*() {
        const repo = yield* AuthRepository
        return yield* repo.findById(UserId.make(value.userId))
      })
    )
  },
  invalidate(session) {
    session.unset("auth")
  }
})

export const loadAuth = () => auth({ schemes: [sessionScheme] })
