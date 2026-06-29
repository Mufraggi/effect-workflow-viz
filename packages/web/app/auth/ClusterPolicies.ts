import { Forbidden } from "@template/domain/auth/Forbidden"
import type { Role } from "@template/domain/auth/Role"
import type { RoleName } from "@template/domain/auth/RoleName"
import { roleNames, toRoleName } from "@template/domain/auth/RoleName"
import { Effect } from "effect"

// ---------------------------------------------------------------------------
// Policy matrix
// ---------------------------------------------------------------------------
// UI only — backend is authoritative. The sidebar uses `canView` to hide
// navigation items, but every guarded handler enforces via `authorize()`.

type PolicyMap = {
  [Entity: string]: {
    [Action: string]: ReadonlyArray<RoleName>
  }
}

export type Policies<M extends PolicyMap> = M

/**
 * Every entity/action pair is mapped to the set of roles that are allowed.
 * Adding a new entity or action requires explicit listing here.
 */
export const clusterPolicies = {
  cluster: {
    overview: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest],
    nodes: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest],
    shards: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest],
    selectEnv: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest]
  },
  workflow: {
    list: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest],
    detail: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest],
    types: [roleNames.admin, roleNames.user, roleNames.readonly, roleNames.guest]
  },
  config: {
    settings: [roleNames.admin, roleNames.user],
    users: [roleNames.admin, roleNames.user],
    environments: [roleNames.admin, roleNames.user]
  }
} as const satisfies Policies<{
  cluster: { overview: Array<RoleName>; nodes: Array<RoleName>; shards: Array<RoleName>; selectEnv: Array<RoleName> }
  workflow: { list: Array<RoleName>; detail: Array<RoleName>; types: Array<RoleName> }
  config: { settings: Array<RoleName>; users: Array<RoleName>; environments: Array<RoleName> }
}>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toLookup = new Map<string, ReadonlyArray<RoleName>>()
for (const [entity, actions] of Object.entries(clusterPolicies)) {
  for (const [action, roles] of Object.entries(actions)) {
    toLookup.set(`${entity}:${action}`, roles)
  }
}

const getAllowedRoles = (entity: string, action: string): ReadonlyArray<RoleName> | undefined =>
  toLookup.get(`${entity}:${action}`)

/**
 * Synchronous check — suitable for UI rendering decisions.
 */
export const canView = (role: Role, entity: string, action: string): boolean => {
  const allowed = getAllowedRoles(entity, action)
  if (!allowed) return false
  const rn = toRoleName(role)
  return allowed.some((r) => r === rn)
}

/**
 * Effectful check — suitable for middleware/handlers.
 * Returns `void` on success or a `Forbidden` error.
 */
export const authorize = (
  role: Role,
  entity: string,
  action: string
): Effect.Effect<void, Forbidden> => {
  if (canView(role, entity, action)) return Effect.void
  return Effect.fail(
    new Forbidden({
      reason: `Role "${role}" is not permitted to ${action} ${entity}`,
      entity,
      action
    })
  )
}
