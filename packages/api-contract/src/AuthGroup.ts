import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, HttpApiSecurity } from "@effect/platform"
import { Email } from "@template/auth/domain/Email"
import { EmailAlreadyTaken, InvalidCredentials, RateLimitExceeded, SessionNotFound } from "@template/auth/domain/errors"
import { Session } from "@template/auth/domain/Session"
import { SessionId } from "@template/auth/domain/SessionId"
import { SessionToken } from "@template/auth/domain/SessionToken"
import { AuthUser } from "@template/auth/domain/User"
import { Context, Schema } from "effect"

const RegisterBody = Schema.Struct({
  email: Email,
  password: Schema.String.pipe(Schema.minLength(8))
})

const LoginBody = Schema.Struct({
  email: Email,
  password: Schema.String
})

export const AuthResponse = Schema.Struct({
  user: AuthUser,
  token: SessionToken
})

export class CurrentSession extends Context.Tag("@template/CurrentSession")<
  CurrentSession,
  { readonly user: AuthUser; readonly session: Session }
>() {}

export class Authorization extends HttpApiMiddleware.Tag<Authorization>()(
  "@template/Authorization",
  {
    failure: SessionNotFound,
    provides: CurrentSession,
    security: { bearer: HttpApiSecurity.bearer }
  }
) {}

export class AuthGroup extends HttpApiGroup.make("auth")
  .add(
    HttpApiEndpoint.post("register", "/auth/register")
      .setPayload(RegisterBody)
      .addSuccess(AuthResponse)
      .addError(EmailAlreadyTaken)
  )
  .add(
    HttpApiEndpoint.post("login", "/auth/login")
      .setPayload(LoginBody)
      .addSuccess(AuthResponse)
      .addError(InvalidCredentials)
      .addError(RateLimitExceeded)
  )
  .add(
    HttpApiEndpoint.post("logout", "/auth/logout")
      .middleware(Authorization)
      .addSuccess(Schema.Void)
  )
  .add(
    HttpApiEndpoint.get("me", "/auth/me")
      .middleware(Authorization)
      .addSuccess(AuthUser)
  )
  .add(
    HttpApiEndpoint.get("sessions", "/auth/sessions")
      .middleware(Authorization)
      .addSuccess(Schema.Array(Session))
  )
  .add(
    HttpApiEndpoint.del("deleteSession", "/auth/sessions/:sessionId")
      .middleware(Authorization)
      .setPath(Schema.Struct({ sessionId: SessionId }))
      .addSuccess(Schema.Void)
  )
{}
