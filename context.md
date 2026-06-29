# Code Context — Audit auth + policy existants pour le rôle invité

## 1. Rôles existants

### Définition des rôles
- **Fichier** : `packages/domain/src/auth/Role.ts` (lignes 1-9)
- **Définition** : `Schema.Literal("admin", "user")`
- **Seulement 2 rôles existent** : `"admin"` et `"user"`. **Aucun rôle `"readonly"` n'existe.**
- La constante est importée et réexportée via `packages/domain/src/index.ts` (ligne 35).

### Attachement du rôle en base
- **Table** : `users` dans la base SQLite auth (fichier auth.db).
- **Création** : `packages/auth/src/AuthRepository.ts` lignes 56-59 (DDL `CREATE TABLE IF NOT EXISTS users`).
- **Colonne** : `role TEXT NOT NULL` (ligne 60).
- **Inséré** lors de `createUser()` (ligne 151) avec la valeur `Role` du paramètre.
- **Modifié** via `updateUser()` (ligne 172) qui reçoit un `role?: Role` optionnel.
- `User` (modèle public) : `packages/domain/src/auth/User.ts` ligne 14 : `role: Role`.
- `UserWithHash` (interne à AuthRepository) : `packages/auth/src/AuthRepository.ts` ligne 17 : `role: Role`.

### Remontée du rôle dans la session jusqu'au handler HTTP
1. **Cookie** : `packages/web/app/auth/cookie.ts` — cookie signé `__session`, HMAC, httpOnly, sameSite Lax, 30 jours.
2. **Session storage** : `packages/web/app/auth/session.ts` — cookie stateless (remix `createCookieSessionStorage`).
3. **Payload session** : `{ userId: string }` uniquement (défini dans `packages/web/app/auth/scheme.ts` ligne 11 — interface `AuthRecord`).
4. **Middleware auth** : `packages/web/app/auth/scheme.ts` — `createSessionAuthSessionScheme<User, AuthRecord>` lit `session.get("auth")`, puis appelle `AuthRepository.findById()` en SQLite pour charger le `User` complet (incluant le rôle).
5. **Context router** : installé comme `context.auth` par `auth()` (via `@remix-run/auth-middleware`). Type = `AuthState<User>` (GoodAuth ou BadAuth).
6. **Utilisation** : Dans le controller, `context.auth.ok ? context.auth.identity.role` (ex: `packages/web/app/actions/controller.tsx` ligne 578).

### Chaîne complète
```
Cookie __session (signé, {userId}) 
  → session middleware (remix) 
    → loadAuth() / scheme.ts 
      → AuthRepository.findById() (SQLite) 
        → User { id, email, role, createdAt } 
          → context.auth: GoodAuth<User> ou BadAuth
```

## 2. Policy layer existant

### Résultat : AUCUN
- **Aucun fichier** `Policy.ts`, `AdminPolicies.ts`, `UserPolicies.ts` n'existe dans le projet.
- **Aucune référence** à `AuthorizedActor`, `CurrentUserAdmin`, `policyUse`, `policyCompose`, `Forbidden`, `withSystemActor` dans le code.
- La grep pour `Policy|AdminPolic|UserPolic|policyUse|policyCompose|CurrentUserAdmin|AuthorizedActor|withSystemActor|Forbidden` n'a retourné aucun résultat.

### Protection actuelle (ad-hoc, sans framework de policies)
- **Toutes les routes workflow** utilisent `protect = [setupGuard(), requireAuthRedirect()]` (controller.tsx ligne 572).
  - `setupGuard()` : redirige vers `/setup` si 0 users en base.
  - `requireAuthRedirect()` : redirige vers `/login?returnTo=...` si non authentifié.
- **Route `/settings`** : protection supplémentaire **ad-hoc** via `context.auth.identity.role === "admin"` (controller.tsx ligne 578). Si admin → affiche users/activity/envs. Si user → `403 Forbidden` sur les POST création/modif/suppression, masque les sections admin.
- **Aucune protection par rôle** n'existe ailleurs (les routes cluster/workflows sont juste `protect` = authentification requise, pas de distinction admin/user).

## 3. Auth middleware

### Extraction token/session et fourniture de l'acteur
- **Fichier** : `packages/web/app/auth/scheme.ts` (lignes 1-27)
- **Fonction** : `loadAuth()` — crée et retourne le middleware `auth({ schemes: [sessionScheme] })`.
- **`sessionScheme`** (lignes 15-27) : `createSessionAuthSessionScheme<User, AuthRecord>` qui :
  1. `read(session)` : lit `session.get("auth")` → `{ userId } | null`
  2. `verify(value)` : appelle `AuthRepository.findById()` via le runtime Effect.
  3. `invalidate(session)` : `session.unset("auth")`

### Contexte Tag portant l'acteur
- **Pas de `Context.Tag` Effect**. L'acteur est porté par le **contexte du router Remix** (`context.auth`), pas par un service Effect.
- `context.auth` est de type `AuthState<User>` (`GoodAuth<User> | BadAuth`).
- Via `context.get(Auth)` (le `Auth` ContextKey de `@remix-run/auth-middleware`).

### Erreur si token absent/invalide
- **401** : la fonction `requireAuth<User>()` dans `packages/web/app/auth/guards.ts` (ligne 35) appelle `onFailure()` qui redirige vers `/login?returnTo=...` avec un **303** (pas un 401 HTTP).
- Le code de statut HTTP est 303 (redirect), pas 401. C'est un redirect vers le formulaire de login.
- **MCP** : retourne un vrai `401 Unauthorized` (packages/mcp/src/auth.ts lignes 59-67).

### Middleware stack (ordre)
`packages/web/app/router.ts` lignes 20-25 :
1. `formData()` — parse les bodies
2. `session(sessionCookie, sessionStorage)` — charge/persiste le cookie signé
3. `loadAuth()` — résout `context.auth` depuis la session
4. `render()` — installe `context.render(...)`

## 4. Handlers HTTP existants (surface à protéger)

Tous dans `packages/web/app/actions/controller.tsx`. Routes définies dans `packages/web/app/routes.ts`.

### Routes CONFIG (Settings, Users, Environments) — *inaccessible au guest*
| Route | Fichier ligne | Méthode | Protégée ? | Notes |
|---|---|---|---|---|
| `/settings` | controller.tsx:575 | GET/POST | `protect` + admin check ad-hoc | Admin only pour les POST (create/update/delete user, create/delete env, manage API keys). User peut voir son profil et ses clés API. |
| `/environments` | controller.tsx:649 | GET | `protect` | JSON list. Pas de check admin — accessible à tout utilisateur authentifié. |
| `/select-env` | controller.tsx:552 | GET | `protect` | Switch d'environnement actif. |

### Routes LECTURE CLUSTER (Overview, Nodes, Shards, Executions, Runs) — *accessible au guest*
| Route | Fichier ligne | Méthode | Protégée ? | Notes |
|---|---|---|---|---|
| `/` (home/runs list) | controller.tsx:562 | GET | `protect` | Server-rendered runs list. |
| `/chart` | controller.tsx:587 | GET | `protect` | Server-rendered scatter chart. |
| `/runs` | controller.tsx:635 | GET | `protect` | JSON paginated runs. |
| `/runs/:messageId` | controller.tsx:640 | GET | `protect` | Run detail page. |
| `/runs/:messageId/children` | controller.tsx:656 | GET | `protect` | Sibling runs (JSON). |
| `/overview` | controller.tsx:653 | GET | `protect` | Cluster overview page. |
| `/overview/stream` | controller.tsx:698 | GET | `protect` | SSE endpoint for live snapshots. |
| `/shards` | controller.tsx:667 | GET | `protect` | Shard distribution page. |
| `/nodes` | controller.tsx:681 | GET | `protect` | Nodes page. |
| `/executions` | controller.tsx:695 | GET | `protect` | Executions list. |
| `/executions/:executionId` | controller.tsx:706 | GET | `protect` | Execution detail. |

### Routes PUBLIQUES (aucune protection)
| Route | Fichier ligne | Méthode | Protégée ? | Notes |
|---|---|---|---|---|
| `/setup` | controller.tsx:604 | GET/POST | Non (self-guard par countUsers) | First-run admin creation. GET affiche le formulaire si 0 users, POST crée l'admin. |
| `/login` | controller.tsx:618 | GET/POST | Non (juste setupGuard) | Formulaire de login. POST vérifie credentials. |
| `/logout` | controller.tsx:640 | POST | Non | Efface la session. |
| `/health` | `server.ts` (avant router) | GET | Non | Liveness. |
| `/health/ready` | `server.ts` (avant router) | GET | Non | Readiness. |
| `/assets/*` | controller.tsx:598 | GET | Non | Static assets. |

### Résumé des protections existantes
- **18 routes HTTP** au total.
- **3 routes publiques** (setup, login, logout) + 2 health + assets.
- **13 routes protégées** par `protect` (authentification requise).
- **0 route avec policy par rôle** : seul `/settings` a un check admin manuel.
- **Pas de distinction guest/user/admin** ailleurs : tout utilisateur authentifié (admin ou user) a le même accès à toutes les routes cluster/workflows.

## 5. Setup / CLI existants

### Création de compte
- **Pas de CLI**. Aucun script CLI pour créer des comptes.
- **Deux voies UI uniquement** :
  1. **First-run** : `GET /setup` → `POST /setup` (controller.tsx lignes 604-616) crée le premier admin. Protégé par comptage de users : si ≥1 user, redirige vers `/login`.
  2. **Admin via Settings** : `POST /settings` avec `intent=create` (controller.tsx lignes 577-634) crée un user (admin ou user, par défaut `user`).
- `AuthRepository.createUser()` (AuthRepository.ts ligne 151) prend un `role` explicite. Aucune valeur par défaut automatique côté repo.
- Le premier compte créé via `/setup` est toujours `"admin"` (hardcodé ligne 614).

### API keys (MCP)
- Créées via `POST /settings` avec `intent=create-key` (controller.tsx lignes 635-637).
- Stockées hashées (Argon2id) dans table `api_keys` (SQLite).
- Utilisées pour l'accès MCP (port 3100), validées via `ApiKeyRepository.validate()`.

### Aucun mécanisme "first-run" pour les environnements
- Les environnements Postgres sont créés via `/settings` (admin seulement, `create-env`).
- Pas de détection automatique ni de configuration initiale.

## Architecture générale

```
server.ts (Node HTTP, port 3000)
  ├── /health, /health/ready → handleHealth() (before router)
  └── router.fetch(request)
       └── middleware stack:
            ├── formData()
            ├── session(cookie, sessionStorage) → lit le cookie __session
            ├── loadAuth() → résout User depuis SQLite via {userId}
            └── render()
       └── rootController (controller.tsx)
            └── chaque route : protect = [setupGuard(), requireAuthRedirect()]
                 ├── setupGuard : si 0 users → redirect /setup
                 ├── requireAuthRedirect : si pas auth → redirect /login
                 └── handler (GET/POST)

Auth DB (SQLite, ./data/auth.db)
  ├── users (id, email, password_hash, role, created_at, last_login_at)
  ├── login_attempts (ip, attempted_at, succeeded)
  ├── audit_log (id, event, user_id, email, ip, created_at)
  └── environments (id, name, host, port, user, password, db_name, ssl, is_default, created_at)

Workflow DB (Postgres, configuré par environment)
  └── accès via DbManager.getClient(envId) → PgClient
       ├── WorkflowReader (listRuns, getRun, getChildRuns, getRunByExecutionId)
       └── OverviewReader (buildSnapshot)
```

## Fichiers clés pour un développeur

| Fichier | Pourquoi |
|---|---|
| `packages/domain/src/auth/Role.ts` | Définition des rôles (ajouter `readonly` ici) |
| `packages/web/app/actions/controller.tsx` | Tous les handlers HTTP + checks admin ad-hoc |
| `packages/web/app/auth/guards.ts` | setupGuard + requireAuthRedirect (point d'extension pour policy) |
| `packages/web/app/auth/scheme.ts` | Résolution de l'acteur courant depuis la session |
| `packages/auth/src/AuthRepository.ts` | CRUD users + rôle en SQLite |
| `packages/web/app/router.ts` | Middleware stack complet |
| `packages/web/app/routes.ts` | Définition de toutes les routes |
| `packages/web/app/data/runtime.ts` | Root layer Effect (AuthRepository + ApiKeyRepository + EnvironmentRepository + DbManager) |

## Start Here
Ouvrir `packages/domain/src/auth/Role.ts` — c'est là qu'il faudra ajouter la valeur `"readonly"` au Literal schema.
Puis `packages/web/app/actions/controller.tsx` pour voir où les checks de rôle ad-hoc existent et où ajouter des policies.

## Constats / Risques
1. **Rôle `readonly` inexistant** : à ajouter dans `Role.ts`.
2. **Zero policy framework** : pas de Policy.ts, pas de `policyUse`/`policyCompose`, pas d' `AuthorizedActor`. Tout est ad-hoc.
3. **Aucune vérification de rôle sur les routes cluster** : tout utilisateur authentifié (admin ou user) voit Overview, Nodes, Shards, Executions, Runs. Un role `readonly` aurait le même accès sans modification.
4. **Le check admin est manuel** : `if (currentUser.role !== "admin") return 403` dans le handler `/settings` uniquement.
5. **`/environments` (GET) n'a pas de check admin** : un user ordinaire peut lister les environnements (noms, hosts, etc.).
6. **Pas de CLI** pour créer des comptes — tout passe par l'UI.
7. **Le `protect` middleware est binaire** (authentifié ou pas). Aucune granularité.
