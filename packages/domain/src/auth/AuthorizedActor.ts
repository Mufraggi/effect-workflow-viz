import type { RoleName } from "./RoleName.js"

/**
 * Phantom type representing an actor who has been authorized to perform
 * `Action` on `Entity`. The type parameters exist only at compile time — the
 * runtime value is a `RoleName`.
 *
 * The only way to construct an `AuthorizedActor` is via the internal
 * `authorizedActor()` function, which is deliberately un-exported so that
 * values of this type can only originate from the policy middleware.
 */
export type AuthorizedActor<_Entity extends string, _Action extends string> = RoleName

/**
 * Internal constructor. Exported but not part of the public API — the
 * convention is that only `policyUse` (in the web app) creates these values,
 * and business services receive them as opaque tokens.
 */
export const authorizedActor = <
  _Entity extends string,
  _Action extends string
>(roleName: RoleName): AuthorizedActor<_Entity, _Action> => roleName as AuthorizedActor<_Entity, _Action>
