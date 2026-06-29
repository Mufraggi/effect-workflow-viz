# Plan d'implémentation — Rôle invité read-only cluster

## Goal
Ajouter un rôle `"guest"` (et `"readonly"` intermédiaire) au système d'authentification, avec une matrice de permissions policy-driven, un middleware de vérification par route, un masquage UI de la sidebar, et un mécanisme de création de compte guest. Le backend reste l'enforceur autoritaire.

---

## Tasks

### 1. Étendre `Role` schema — ajouter `"readonly"` et `"guest"`

- **File**: `packages/domain/src/auth/Role.ts`
- **Changes**: Passer de `Schema.Literal("admin", "user")` à `Schema.Literal("admin", "user", "readonly", "guest")`
- **Acceptance**: `Role` type accepte les 4 valeurs. Tous les usages existants (admin/user) continuent de fonctionner.

### 2. Créer les branded constants de rôle (`RoleName.ts`)

- **File (new)**: `packages/domain/src/auth/RoleName.ts`
- **Changes**:
  ```ts
  // Branded strings pour le policy system (pas de string littéral en dur).
  // Chaque rôle est sa propre marque, ce qui permet au type system de
  // distinguer statiquement les permissions.
  export const RoleName = Schema.String.pipe(Schema.brand("RoleName"))
  export type RoleName = typeof RoleName.Type

  export const AdministratorRoleName = Schema.String.pipe(Schema.brand("AdministratorRoleName"))
  export type AdministratorRoleName = typeof AdministratorRoleName.Type

  // Helpers pour convertir Role → RoleName (evite les casts partout)
  export const toRoleName: (role: Role) => RoleName
  ```
- **Acceptance**: `AdministratorRoleName.make("guest")` compile et produit une valeur brandée. Les rôles existants peuvent être convertis.

### 3. Créer l'erreur `Forbidden` (403)

- **File (new)**: `packages/domain/src/auth/Forbidden.ts`
- **Changes**:
  ```ts
  import { Schema } from "effect"

  export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
    reason: Schema.String,
    action: Schema.String,
    entity: Schema.String
  }) {
    // Marqueur statique HttpApiSchema.annotations status 403
    static [HttpApiSchema.annotations]() { return { status: 403 as const } }
  }
  ```
- **Acceptance**: `Forbidden` est un `Schema.TaggedError` distinct de `InvalidCredentials` (401), avec un champ `reason` et les annotations HTTP 403.

### 4. Créer le phantom type `AuthorizedActor<Entity, Action>`

- **File (new)**: `packages/domain/src/auth/AuthorizedActor.ts`
- **Changes**:
  ```ts
  // Phantom type — jamais construit manuellement en dehors de authorizedActor().
  // Entity et Action sont des string literals qui verrouillent les permissions.
  export declare class AuthorizedActor<out Entity extends string, out Action extends string> {
    readonly _Entity: Entity
    readonly _Action: Action
  }

  // Constructeur interne — seule façon de créer un AuthorizedActor.
  export const authorizedActor: <E extends string, A extends string>(
    entity: E, action: A
  ) => AuthorizedActor<E, A>
  ```
- **Acceptance**: Impossible de créer un `AuthorizedActor<"config", "settings">` sans passer par `authorizedActor("config", "settings")`.

### 5. Créer `ClusterPolicies.ts` — matrice de permissions

- **File (new)**: `packages/web/app/auth/ClusterPolicies.ts`
- **Changes**:
  ```ts
  // Entités et actions — le `satisfies` verrouille la forme.
  export const ClusterPolicies = {
    cluster: {
      overview: { action: "read", roles: ["admin", "user", "readonly", "guest"] },
      nodes:    { action: "read", roles: ["admin", "user", "readonly", "guest"] },
      shards:   { action: "read", roles: ["admin", "user", "readonly", "guest"] },
    },
    workflow: {
      list:   { action: "read", roles: ["admin", "user", "readonly", "guest"] },
      detail: { action: "read", roles: ["admin", "user", "readonly", "guest"] },
      types:  { action: "read", roles: ["admin", "user", "readonly", "guest"] },
    },
    config: {
      settings:     { action: "read", roles: ["admin", "user"] },
      users:        { action: "read", roles: ["admin", "user"] },
      environments: { action: "read", roles: ["admin", "user"] },
    },
  } satisfies Policies<{
    cluster: { overview: "read"; nodes: "read"; shards: "read" }
    workflow: { list: "read"; detail: "read"; types: "read" }
    config: { settings: "read"; users: "read"; environments: "read" }
  }>
  ```
  - **Détail**: Le type `Policies` est une interface générique qui force chaque entitité à mapper des clés d'action vers un `{ action: string; roles: RoleName[] }`. Le `satisfies` empêche l'ajout d'entités/actions non déclarées.

- **Helper `canView(role, entity, action)`**: fonction synchrone exportée pour l'UI.
  ```ts
  export function canView(role: Role, entity: keyof typeof ClusterPolicies, action: string): boolean
  ```

- **Helper `authorize(role, entity, action)`**: retourne `Effect<void, Forbidden>` pour le backend.

- **Acceptance**: `ClusterPolicies.cluster.overview.roles` contient `"guest"`. `ClusterPolicies.config.settings.roles` ne contient **pas** `"guest"`. `canView("guest", "config", "settings")` retourne `false`.

### 6. Créer le middleware `policyUse`

- **File (new)**: `packages/web/app/auth/policy.ts`
- **Changes**:
  ```ts
  // Middleware Remix qui vérifie que l'utilisateur courant a le droit d'accéder
  // à une entité/action. Se base sur context.auth.identity.role et ClusterPolicies.
  export function policyUse(entity: string, action: string): Middleware
  // Comportement:
  //   - si context.auth.ok === false → 401 (via requireAuthRedirect, normal)
  //   - si le rôle n'est pas autorisé → throw Forbidden → catch dans le controller → 403
  ```
- **Acceptance**: Un guest accédant à `/settings` reçoit un 403. Un guest accédant à `/overview` passe.

### 7. Protéger chaque route du controller avec `policyUse`

- **File**: `packages/web/app/actions/controller.tsx`
- **Changes**:
  - Remplacer le `protect` unique par un protect par route :
    - **Routes cluster** (overview, nodes, shards, overviewStream) : ajouter `policyUse("cluster", "overview")` etc.
    - **Routes workflow** (home, chart, runs, runShow, runChildren, executions, executionShow) : ajouter `policyUse("workflow", "list")` etc.
    - **Route settings** : ajouter `policyUse("config", "settings")`
    - **Route environments** (GET) : ajouter `policyUse("config", "environments")`
  - Supprimer le check ad-hoc `isAdmin` sur les POST settings (remplacé par `policyUse("config", "users")` pour les actions utilisateur et `policyUse("config", "environments")` pour les actions environnement).
  - Gérer le `Forbidden` error dans le handler (soit middleware catch, soit try-catch dans le handler).
- **Acceptance**: Chaque route cluster/workflow lance `policyUse`. Les routes config sont bloquées pour guest/readonly.

### 8. Masquer les entrées de nav interdites dans la Sidebar

- **File**: `packages/web/app/components/layout/Sidebar.tsx`
- **Changes**:
  - Importer `canView` depuis `ClusterPolicies.ts`
  - Passer le rôle de l'utilisateur courant à la Sidebar (via AppLayout props ou context)
  - Filtrer `NAV_ITEMS` avec `canView(role, entity, action)` avant de render
  - Ajouter un mapping `NavItem → (entity, action)` pour chaque item :
    - overview → `{ entity: "cluster", action: "overview" }`
    - nodes → `{ entity: "cluster", action: "nodes" }`
    - shards → `{ entity: "cluster", action: "shards" }`
    - executions → `{ entity: "workflow", action: "list" }`
    - settings → `{ entity: "config", action: "settings" }`
    - schedules, alerts → pas de policy encore (laissés tels quels ou masqués si pas de href)
  - Pour les items sans href (schedules, alerts) : masquer si role ≤ guest ou laisser tel quel (hors scope)
- **Acceptance**: Un guest ne voit pas "Settings" dans la sidebar. Il voit Overview, Nodes, Shards, Executions.

### 9. Propager le `currentUserRole` dans le rendu pour la Sidebar

- **File**: `packages/web/app/components/layout/AppLayout.tsx`
- **Changes**:
  - Ajouter un champ `currentUserRole?: string` aux props `AppLayoutProps`
  - Le passer à `Sidebar`
- **File**: `packages/web/app/actions/controller.tsx`
- **Changes**:
  - Pour chaque handler qui appelle `context.render(...)`, passer `currentUserRole: context.auth.identity.role` dans les props du layout
- **Acceptance**: La Sidebar reçoit le rôle et peut filtrer les entrées.

### 10. Créer un mécanisme de création de compte guest

- **Option A — CLI script**: Créer `scripts/create-guest-account.ts`
  ```ts
  // Lit email + password depuis les args ou l'environnement
  // Appelle AuthRepository.createUser({ email, passwordHash, role: "guest" })
  // via le runtime Effect
  ```
- **Option B — Settings page extension**: Dans l'onglet Users, ajouter "guest" aux options de rôle (admin seulement).
- **Option C — Les deux**: CLI pour l'automatisation + extension Settings UI.
- **Recommendation**: Commencer par CLI (automatisable), puis étendre le Settings UI.

- **File (new)**: `scripts/create-guest-account.ts`
- **File**: `packages/web/app/actions/settings-page.tsx` (étendre les selects de rôle pour inclure readonly/guest)
- **File**: `packages/web/app/actions/controller.tsx` (ajouter readonly/guest aux schemas de validation)
- **Acceptance**: `pnpm tsx scripts/create-guest-account.ts --email guest@example.com --password secret123` crée un compte avec role=guest.

### 11. Mettre à jour les schemas de validation dans le controller

- **File**: `packages/web/app/actions/controller.tsx`
- **Changes**:
  - `createUserSchema` : étendre l'union `s.literal("admin") | s.literal("user")` pour inclure `s.literal("readonly")` et `s.literal("guest")`
  - `updateUserSchema` : pareil
- **Acceptance**: L'admin peut créer/modifier des comptes avec les nouveaux rôles via Settings.

### 12. Ajouter les exports dans `packages/domain/src/index.ts`

- **File**: `packages/domain/src/index.ts`
- **Changes**:
  - Ajouter `export * as RoleName from "./auth/RoleName.js"`
  - Ajouter `export * as Forbidden from "./auth/Forbidden.js"`
  - Ajouter `export * as AuthorizedActor from "./auth/AuthorizedActor.js"`
- **Acceptance**: Les nouveaux modules sont accessibles via `@template/domain`.

### 13. Tests — ajouter des tests pour la matrice de permissions

- **File (new)**: `packages/web/test/auth/ClusterPolicies.test.ts`
- **Changes**:
  - Tester que `canView("guest", "cluster", "overview")` → `true`
  - Tester que `canView("guest", "config", "settings")` → `false`
  - Tester que `canView("admin", "config", "settings")` → `true`
  - Tester que `authorize("guest", "config", "settings")` → `Effect<never, Forbidden, never>`
- **Acceptance**: Les tests passent, validant la matrice et les helpers.

---

## Files to Modify

| File | Change |
|---|---|
| `packages/domain/src/auth/Role.ts` | Ajouter `"readonly"` et `"guest"` au Literal schema |
| `packages/domain/src/index.ts` | Exporter les nouveaux modules |
| `packages/web/app/actions/controller.tsx` | Remplacer `protect` par `policyUse` par route + étendre les schemas de validation + supprimer checks ad-hoc |
| `packages/web/app/components/layout/Sidebar.tsx` | Filtrer NAV_ITEMS par rôle + ajouter mapping entity/action |
| `packages/web/app/components/layout/AppLayout.tsx` | Propager `currentUserRole` à Sidebar |
| `packages/web/app/actions/settings-page.tsx` | Ajouter readonly/guest aux selects de rôle |
| `packages/web/server.ts` | (Optionnel) Ajouter route pour CLI health check |

## New Files

| File | Purpose |
|---|---|
| `packages/domain/src/auth/RoleName.ts` | Branded role name constants (`AdministratorRoleName`, etc.) |
| `packages/domain/src/auth/Forbidden.ts` | `Forbidden` TaggedError (403) |
| `packages/domain/src/auth/AuthorizedActor.ts` | Phantom type `AuthorizedActor<Entity, Action>` |
| `packages/web/app/auth/ClusterPolicies.ts` | Matrice de permissions + helpers `canView` / `authorize` |
| `packages/web/app/auth/policy.ts` | Middleware `policyUse(entity, action)` |
| `scripts/create-guest-account.ts` | CLI pour créer un compte guest |
| `packages/web/test/auth/ClusterPolicies.test.ts` | Tests unitaires de la matrice |

---

## Dependencies

| Task | Depends On |
|---|---|
| 1 (Role extension) | — |
| 2 (RoleName branded) | 1 |
| 3 (Forbidden) | — |
| 4 (AuthorizedActor) | — |
| 5 (ClusterPolicies) | 1, 2, 3, 4 |
| 6 (policyUse middleware) | 5 |
| 7 (Route protection) | 6 |
| 8 (Sidebar filtering) | 5 |
| 9 (Propagate role to UI) | 8 |
| 10 (Guest account creation) | 1 |
| 11 (Settings validation) | 1 |
| 12 (Domain exports) | 2, 3, 4 |
| 13 (Tests) | 5 |

---

## Risks

1. **Le middleware Remix `requireAuth` est binaire** — le nouveau `policyUse` doit s'intercaler **après** `requireAuth` (qui a déjà vérifié `context.auth.ok`). Ordre : `[setupGuard(), requireAuthRedirect(), policyUse(...)]`.
2. **`/environments` (GET) n'a actuellement pas de check admin** — un `user` peut lister les environnements. Avec la nouvelle policy `config.environments → allowRoles(admin, user)`, ce comportement est préservé (user peut toujours voir), mais guest sera bloqué.
3. **Sidebar : `schedules` et `alerts` n'ont pas de route associée** (pas de `href`) — ils sont déjà désactivés visuellement quand pas de env. Pour guest, on peut les laisser tels quels (hors scope) ou les masquer avec une policy dummy "future" (workflow.schedules, workflow.alerts).
4. **settings-page.tsx a des selects de rôle en dur** (`<option value="user">`, `<option value="admin">`) — il faut les rendre dynamiques ou au moins ajouter `readonly` et `guest`.
5. **La fonction `canView` côté UI n'est qu'un masquage** — le backend reste l'enforceur. Documenter ce choix dans le code et dans ce plan.
6. **Le `createUserSchema` et `updateUserSchema` du controller utilisent `s.union([s.literal("admin"), s.literal("user")])`** — il faut étendre ces unions. Attention à ne pas casser les schémas existants.
7. **Pas de CLI existante** — la création de `scripts/create-guest-account.ts` nécessite d'importer le runtime Effect (AuthRepository + SqliteLive) depuis le contexte du script, pas du web. Vérifier que les dépendances SQLite fonctionnent en standalone.

---

## À valider par Hugo

Avant de transmettre ce plan au worker d'implémentation, merci de confirmer les points suivants :

### 1. Context.Tag acteur
- **Constats** : Le système existant n'utilise **pas** de `Context.Tag` Effect pour l'acteur. L'acteur est porté par `context.auth` (Remix middleware), de type `GoodAuth<User> | BadAuth`.
- **Question** : Doit-on créer un `Context.Tag` Effect (`CurrentUser` ou `CurrentUserAdmin`) pour l'acteur courant, ou rester avec le pattern existant `context.auth.identity.role` ?
  - Si oui : `packages/domain/src/auth/CurrentUser.ts` — `Context.Tagged<CurrentUser, User>()`
  - Si non : adapter `policyUse` pour lire le rôle depuis `context.auth.identity.role`
- **Proposition** : Reste sur `context.auth.identity.role` (pas de Context.Tag supplémentaire) car ça évite un refactor lourd et le pattern Remix est déjà en place.

### 2. Type du champ rôle
- **Constats** : Actuellement `Role = Schema.Literal("admin", "user")` — simple union de strings.
- **Question** : Faut-il créer des branded constants (`AdministratorRoleName.make("guest")`) comme le suggère la consigne, ou simplement étendre le Literal existant ?
- **Proposition** : Les deux. Étendre `Role` (pour la DB, les schemas) **et** créer `RoleName` brandé (pour le policy system). Le `toRoleName` convertit l'un à l'autre.

### 3. Nom exact de la constante de rôle guest
- **Proposition** : `AdministratorRoleName.make("guest")` — mais le nom `AdministratorRoleName` est trompeur pour un rôle guest. Suggestion : créer plutôt `RoleName` (brandé) avec des helpers :
  ```ts
  export const roleNames = {
    admin: RoleName.make("admin"),
    user: RoleName.make("user"),
    readonly: RoleName.make("readonly"),
    guest: RoleName.make("guest")
  } as const
  ```
  - **À valider** : Préférez-vous `AdministratorRoleName` ou `RoleName` ?

### 4. Routes config identifiées — sont-elles les bonnes ?
| Route | Policy | Guest accès |
|---|---|---|
| `/settings` | `config.settings` | ❌ Bloqué (403) |
| `/environments` (GET) | `config.environments` | ❌ Bloqué (403) |
| `/environments` (POST) | `config.environments` | ❌ Bloqué (403) |
| `/select-env` | `config.environments` | ⚠️ Switch d'environnement actif — nécessaire pour guest ? |
| **Routes cluster** | `cluster.*` | ✅ Autorisé |
| **Routes workflow** | `workflow.*` | ✅ Autorisé |

- **Question** : `/select-env` est-il nécessaire pour guest ? Sans ça, un guest ne peut pas changer d'environnement (bloqué par la sidebar ou par un 403). **Proposition** : Laisser guest accéder à `/select-env` (nécessaire pour utiliser l'app), mais avec `policyUse("config", "environments")` déjà restreint. Alternative : créer une entrée `cluster.selectEnv` dans la matrice.

### 5. Gestion des POST dans `/settings`
- Actuellement, le handler `/settings` a des POSTs pour `create`, `update`, `delete` user, `create-env`, `delete-env`, `create-key`, `revoke-key`.
- **Question** : Faut-il des policies distinctes pour les mutations (ex: `config.users.create`), ou la policy `config.settings` (read) suffit-elle puisque le handler retourne déjà 403 sur les POST non-admin ?
- **Proposition** : Pour v1, un guest accédant à `/settings` reçoit un 403 de `policyUse("config", "settings")` avant même le handler, ce qui bloque tout GET/POST. C'est suffisant.

### 6. Nom du fichier `ClusterPolicies.ts`
- Emplacement proposé : `packages/web/app/auth/ClusterPolicies.ts`
- **Question** : Doit-il plutôt être dans `packages/domain/src/auth/` pour être partagé avec le backend ? **Proposition** : Dans `packages/web/app/auth/` car le pattern `canView` UI en dépend et la matrice est propre à cette app web.

Merci de valider/infirmer ces points avant que je lance le worker.
