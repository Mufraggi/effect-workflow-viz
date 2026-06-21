# Code Context — Audit pour exposition MCP read-only

## 1. ClusterStorageReader / OverviewReader

### Fichier
`packages/database/src/repository/overviewReader/OverviewReader.ts`

### Méthodes existantes
La fonction `makeOverviewReader(sql: SqlClient.SqlClient)` retourne un objet stateless avec :

| Méthode / Query | Description |
|---|---|
| `workflowStatsSchema({})` | Workflow counts by status (CASE pending/running/success/failed_app/crashed/interrupted/unknown) |
| `activitySchema({ fromTs, toTs })` | Activité par buckets de 15 min sur 24h (completed / failed) |
| `shardCountsSchema({})` | Distribution des messages par shard |
| `entityTypesSchema({})` | Types d'entités (workflow names) distincts |
| `activeRunnersSchema({})` | Runners avec heartbeat < 35s |
| `allRunnersSchema({})` | Tous les runners (y compris stale) |
| `shardAssignmentsSchema({})` | Assignations shards depuis `cluster_locks` avec `acquired_at > NOW() - INTERVAL '35 seconds'` |
| `maxShardSchema({})` | Max shard number observé |
| `shardEntitiesSchema({})` | Nombre d'entités distinctes par shard |
| `recentCountSchema({ since })` | Nombre de messages récents pour débit |
| `buildSnapshot()` | Exécute les 10 requêtes ci-dessus en parallèle et assemble le snapshot brut |

### Schémas Schema.Struct de sortie
Tous sont définis dans le même fichier (OverviewReader.ts) :

- `WorkflowStatsResult` (l. 13-16) — `{ status: string, count: number }`
- `ActivityRow` (l. 18-22) — `{ bucket, bucketEpochMs, completed, failed }`
- `ShardCountRow` (l. 24-27) — `{ shardId, messageCount }`
- `EntityTypeRow` (l. 29-31) — `{ entityType }`
- `CountResult` (l. 33-35) — `{ count }`
- `ActiveRunnerRow` (l. 37-42) — `{ address, runner, healthy, lastHeartbeat }`
- `ShardAssignmentRow` (l. 44-48) — `{ shardId, address, acquiredAt }`
- `MaxShardResult` (l. 50-52) — `{ maxShard }`
- `ShardEntityRow` (l. 54-57) — `{ shardId, entityCount }`

### Export
`packages/database/src/index.ts` l. 12 → `export * as OverviewReader from "./repository/overviewReader/OverviewReader.js"`

---

## 2. Règles de décodage status et expiration des locks

### Status — centralisé dans le domaine
**Fichier:** `packages/domain/src/workflow/decode/status.ts`

Fonction `decodeRunStatus(input)` (l. 17-58) — règle unique :

1. Pas de reply (`replyKind === null || replyPayload === null`) :
   - `lastRead === null` → `"pending"`
   - `now - lastRead < 10 min` → `"running"` (constante `RUNNING_THRESHOLD_MS = 10 * 60 * 1000` l. 3)
   - sinon → `"pending"`

2. `replyKind !== 0` → `"unknown"`

3. Parse JSON du `replyPayload`, examine le `_tag` de l'Exit :
   - `"Success"` → `"success"`
   - `"Failure"` → examine la Cause racine : `"Fail"` → `"failed_app"`, `"Die"` → `"crashed"`, `"Interrupt"` → `"interrupted"`

**Fichier:** `packages/domain/src/workflow/decode/exit.ts`
- `decodeExitTag(json)` — lit `_tag` ∈ { "Success", "Failure" }
- `decodeCauseRoot(cause)` — parcourt l'arbre Cause (Sequential/Parallel) pour trouver `"Fail"` | `"Die"` | `"Interrupt"` | `"Empty"`

**Fichier:** `packages/domain/src/workflow/decode/workflow.ts`
- `unwrapWorkflowResult(value)` — dépaquette le `exit` interne d'un WorkflowResult `{ _tag: "Complete", exit }`

### Utilisation dans l'OverviewReader
**Fichier:** `packages/database/src/repository/overviewReader/OverviewReader.ts` l. 63-91

Une règle SQL **dupliquée** dans `workflowStatsSchema` :
```sql
CASE
  WHEN m.last_reply_id IS NULL AND m.last_read IS NULL THEN 'pending'
  WHEN m.last_reply_id IS NULL AND m.last_read >= NOW() - INTERVAL '10 minutes' THEN 'running'
  WHEN m.last_reply_id IS NULL THEN 'pending'
  WHEN r.kind IS DISTINCT FROM 0 THEN 'unknown'
  ELSE COALESCE(
    CASE
      WHEN r.payload LIKE '%"exit":{"_tag":"Success"%' THEN 'success'
      WHEN r.payload LIKE '%"exit":{"_tag":"Failure"%' AND r.payload LIKE '%"_tag":"Fail",%' THEN 'failed_app'
      WHEN r.payload LIKE '%"exit":{"_tag":"Failure"%' AND r.payload LIKE '%"_tag":"Die",%' THEN 'crashed'
      WHEN r.payload LIKE '%"exit":{"_tag":"Failure"%' AND r.payload LIKE '%"_tag":"Interrupt",%' THEN 'interrupted'
      ELSE 'unknown'
    END, 'unknown'
  )
END AS status
```

→ C'est une **duplication** de la logique du domaine en SQL (pattern matching sur JSON), pas un appel au code TypeScript centralisé.

### Expiration des locks — dupliquée elle aussi

**Dans OverviewReader** (SQL, l. 171) :
```sql
WHERE acquired_at > NOW() - INTERVAL '35 seconds'
```

**Dans `buildSnapshotFromDb`** (`packages/web/app/types/overview.ts` l. 118 et 149-152) :
```typescript
const LOCK_EXPIRY_MS = 35_000
// double-check côté JS sur les dates parsées
if (!Number.isNaN(acquiredMs) && (nowMs - acquiredMs) < LOCK_EXPIRY_MS) {
  assignedShardMap.set(a.shardId, a.address)
}
```

Même constante `35` secondes dans les deux, mais en deux endroits distincts.

Runners heartbeat : même seuil de 35s utilisé dans `activeRunnersSchema` (SQL) et `activeRunnerAddresses` (JS côté types/overview.ts).

---

## 3. DbManager / mécanisme multi-environnement

### DbManager
**Fichier:** `packages/environments/src/DbManager.ts`

- Service Effect `DbManager` (scoped) avec une méthode unique `getClient(envId: string): Effect<PgClient>`.
- Utilise `Effect.cachedFunction` (l. 39) pour créer et mettre en cache un pool Postgres par envId.
- Les connections sont créées via `makePgLayer` (de `@template/database/PgLive`), même approche.
- Les pools sont stockés dans un `Map<string, ManagedRuntime>` local.

### Résolution depuis une requête entrante
**Fichier:** `packages/web/app/actions/controller.tsx`

1. L'envId est stocké dans la **session Remix** (cookie signé) via `session.get("envId")` — string ou undefined.
2. L'utilisateur sélectionne un environnement via `GET /select-env?envId=xxx` (l. 405-422 de controller.tsx), qui vérifie l'existence via `EnvironmentRepository.getById(envId)` puis le stocke dans la session.
3. Tous les loaders lisent `session?.get?.("envId") as string | undefined`.
4. S'il est présent, ils appellent `DbManager.getClient(envId)` pour obtenir un `PgClient`, puis construisent un reader (`makeOverviewReader` ou `makeWorkflowReader`) avec ce client.

### EnvironmentConfig
**Fichier:** `packages/environments/src/EnvironmentConfig.ts`
- Schema.Class avec id, name, host, port, user, password, dbName, ssl, isDefault, createdAt.

### EnvironmentRepository
**Fichier:** `packages/environments/src/EnvironmentRepository.ts`
- Stocké dans la **même SQLite** que l'auth (table `environments` dans `auth.db`).
- Méthodes : `list`, `getById`, `getByName`, `getDefault`, `create`, `update`, `delete`.
- DDL exécuté dans `AuthRepository.ts` (l. 59-68) et aussi dans `EnvironmentRepository.ts` (l. 62-76) — **duplication de la création de table**.

### Runtime racine
**Fichier:** `packages/web/app/data/runtime.ts`
```typescript
const AppLayer = Layer.mergeAll(
  AuthRepository.Default,
  EnvironmentRepository.Default,
  DbManager.Default
)
export const runtime = ManagedRuntime.make(AppLayer)
```

---

## 4. @effect/ai et code MCP existant

### @effect/ai
**Aucune occurrence.** Ni dans `package.json` racine, ni dans aucun `packages/*/package.json`. Les dépendances Effect sont :
- `effect@3.21.3` (racine + tous les packages)
- `@effect/sql`, `@effect/sql-pg`, `@effect/sql-sqlite-node`
- `@effect/platform`, `@effect/platform-node`
- `@effect/build-utils`, `@effect/eslint-plugin`, `@effect/language-service`, `@effect/vitest` (dev)

### Code MCP
**Aucun code MCP n'existe dans le code source.** La seule référence à `mcp` est dans `.claude/settings.local.json` (permissions Claude Desktop) — pas du code applicatif.
- `McpServer`, `Toolkit`, `AiTool` : introuvables dans tout le code source.

---

## 5. Montage du serveur HTTP actuel

### Fichier: `packages/web/server.ts`

Le serveur HTTP est un serveur **Node.js `http` natif**, pas un serveur Effect :

```typescript
const server = http.createServer(
  createRequestListener(async (request, client) => {
    const health = await handleHealth(request)
    if (health) return health
    if (client?.address) clientAddresses.set(request, client.address)
    return router.fetch(request)
  })
)
server.listen(PORT, ...)
```

- `createRequestListener` de `remix/node-fetch-server` adapte une `fetch(request) → Response` en `http.createServer` handler.
- Le `router` est un Remix 3 Router (`packages/web/app/router.ts`) avec une stack middleware : `formData() → session() → loadAuth() → render()`.
- Pas de `HttpApiBuilder`, `HttpLayerRouter`, `NodeHttpServer` d'Effect.

### Possibilité de greffer un endpoint MCP
Le serveur est un `http.createServer` vanilla. On pourrait :
- **Même port** : ajouter un handler dans le callback avant ou après `router.fetch(request)`, en routant sur un chemin spécifique (ex: `/mcp`).
- **Port séparé** : créer un second `http.createServer` sur un autre port.

Aucune barrière technique à l'une ou l'autre approche.

---

## 6. Auth / session existante

### Session
**Fichier:** `packages/web/app/auth/session.ts`
- Session **stateless** via `createCookieSessionStorage()` de Remix.
- Le cookie `__session` (`packages/web/app/auth/cookie.ts`) est **HMAC-signé**, HTTP-only, SameSite=Lax, secure en production, maxAge=30 jours.
- Contenu : `{ userId: string }` (l'identifiant de l'utilisateur).

### Auth scheme
**Fichier:** `packages/web/app/auth/scheme.ts`
- `createSessionAuthScheme` lit `session.get("auth")` et vérifie l'utilisateur via `AuthRepository.findById(UserId.make(value.userId))`.
- `loadAuth()` est un middleware Remix qui résout `context.auth`.

### Guards
**Fichier:** `packages/web/app/auth/guards.ts`
- `setupGuard()` : redirige vers `/setup` si aucun compte n'existe.
- `requireAuthRedirect()` : redirige vers `/login` avec `returnTo` si non authentifié.

### Provider credentials
**Fichier:** `packages/web/app/auth/provider.ts`
- Email/password via scrypt (Argon2id).

### Réutilisable pour MCP ?
Oui — la session est déjà vérifiée pour toutes les routes protégées. Le cookie serait envoyé par le client MCP. On pourrait aussi envisager un header API key ou un bearer token pour les clients MCP qui ne gèrent pas les cookies. L'infrastructure de session est en place et mature.

---

## Résumé des risques / duplications identifiés

| Problème | Fichiers concernés |
|---|---|
| Décodage status dupliqué (SQL CASE vs TypeScript `decodeRunStatus`) | `overviewReader/OverviewReader.ts:63-91` vs `domain/workflow/decode/status.ts` |
| Lock expiration dupliqué (SQL `35 seconds` vs JS `35_000` ms) | `overviewReader/OverviewReader.ts:171` vs `web/app/types/overview.ts:118,149-152` |
| DDL de la table `environments` dupliqué | `auth/AuthRepository.ts:59-68` vs `environments/EnvironmentRepository.ts:62-76` |
| Aucune isolation de la logique métier (OverviewReader mélange SQL et mapping) | `overviewReader/OverviewReader.ts` |
| Aucun code MCP ou @effect/ai existant | — |
| Pas de serveur HTTP Effect (vanilla Node http) | `web/server.ts` |

## Fichiers clés à ouvrir en premier

1. **`packages/database/src/repository/overviewReader/OverviewReader.ts`** — le reader existant le plus pertinent pour exposer les données via MCP.
2. **`packages/environments/src/DbManager.ts`** — le mécanisme de résolution de connexion par environnement (dont le nouveau endpoint MCP aura besoin).
3. **`packages/web/app/actions/controller.tsx`** — pour voir le pattern "loader with envId" qui sert de modèle aux handlers MCP.
4. **`packages/web/server.ts`** — le point d'entrée HTTP où greffer un nouveau serveur ou endpoint.
