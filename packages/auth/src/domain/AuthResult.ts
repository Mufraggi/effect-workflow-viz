import type { SessionToken } from "./SessionToken.js"
import type { AuthUser } from "./User.js"

export interface AuthResult {
  readonly user: AuthUser
  readonly token: SessionToken
}
