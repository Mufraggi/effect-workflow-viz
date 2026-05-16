import { HttpApiBuilder } from "@effect/platform"
import { Api } from "@template/api-contract/Api"
import { CurrentSession } from "@template/api-contract/AuthGroup"
import {
  DeleteSessionCommand,
  ListSessionsQuery,
  loginAttemptRepository,
  LoginCommand,
  LogoutCommand,
  PasswordHasher,
  RegisterCommand,
  sessionRepository,
  userRepository
} from "@template/auth"
import { AuthDbLive } from "@template/auth/db/AuthDb"
import type { IpAddress } from "@template/auth/domain/IpAddress"
import { Effect, Layer } from "effect"
import { AuthorizationLive } from "./AuthorizationLive.js"

export const AuthLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  Effect.gen(function*() {
    const register = yield* RegisterCommand.RegisterCommand
    const login = yield* LoginCommand.LoginCommand
    const logout = yield* LogoutCommand.LogoutCommand
    const listSessions = yield* ListSessionsQuery.ListSessionsQuery
    const deleteSession = yield* DeleteSessionCommand.DeleteSessionCommand

    return handlers
      .handle("register", ({ payload, request }) =>
        register.execute({
          email: payload.email,
          password: payload.password,
          userAgent: request.headers["user-agent"] ?? null
        }).pipe(Effect.catchTag("PasswordHashingError", Effect.die)))
      .handle("login", ({ payload, request }) =>
        login.execute({
          email: payload.email,
          password: payload.password,
          ipAddress: extractIp(request.headers) ?? null,
          userAgent: request.headers["user-agent"] ?? null
        }).pipe(Effect.catchTag("PasswordVerificationError", Effect.die)))
      .handle("logout", () =>
        Effect.gen(function*() {
          const { session } = yield* CurrentSession
          yield* logout.execute(session.id)
        }))
      .handle("me", () =>
        Effect.gen(function*() {
          const { user } = yield* CurrentSession
          return user
        }))
      .handle("sessions", () =>
        Effect.gen(function*() {
          const { user } = yield* CurrentSession
          return yield* listSessions.execute(user.id)
        }))
      .handle("deleteSession", ({ path }) =>
        Effect.gen(function*() {
          const { user } = yield* CurrentSession
          yield* deleteSession.execute(path.sessionId, user.id)
        }))
  })).pipe(
    Layer.provide(RegisterCommand.RegisterCommand.Default),
    Layer.provide(LoginCommand.LoginCommand.Default),
    Layer.provide(LogoutCommand.LogoutCommand.Default),
    Layer.provide(ListSessionsQuery.ListSessionsQuery.Default),
    Layer.provide(DeleteSessionCommand.DeleteSessionCommand.Default),
    Layer.provide(PasswordHasher.PasswordHasher.Default),
    Layer.provide(
      AuthorizationLive.pipe(
        Layer.provide(userRepository.UserRepository.Default),
        Layer.provide(sessionRepository.SessionRepository.Default)
      )
    ),
    Layer.provide(
      Layer.mergeAll(
        userRepository.UserRepository.Default,
        sessionRepository.SessionRepository.Default,
        loginAttemptRepository.LoginAttemptRepository.Default
      )
    ),
    Layer.provide(AuthDbLive)
  )

const extractIp = (headers: Record<string, string>): IpAddress | undefined => {
  const forwarded = headers["x-forwarded-for"]
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first as IpAddress
  }
  const real = headers["x-real-ip"]
  if (real) return real as IpAddress
  return undefined
}
