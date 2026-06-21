# Effect Workflow Viz

A read-only observability dashboard and MCP server for [Effect](https://effect.website) Cluster workflows.

Monitor your Effect Cluster in real time through a web UI and query it programmatically via the Model Context Protocol (MCP) — allowing AI assistants like Claude to inspect workflow executions, nodes, shards, and cluster health.

---

## Features

**Web UI** (Remix SPA on port 3000)

- **Overview** — live cluster dashboard with workflow stats, activity chart, nodes, and shards
- **Executions** — paginated list of workflow runs with status, duration, and filtering
- **Execution detail** — full run details, message IDs, trace information
- **Nodes** — runner status and shard assignments
- **Shards** — dense heatmap of shard distribution
- **Settings** — environment configuration, user management, and API key generation
- **Chart** — scatter plot of run start time × duration, colored by status

**MCP Server** (HTTP/SSE on port 3100)

- **Resources** — snapshots of cluster state (overview, nodes, shards, workflow types)
- **Tools** — parameterized queries (list executions, get execution details, get children)
- **Read-only strict** — zero mutation capabilities
- **Per-environment** — switch between multiple Postgres databases
- **Auth** — API key validation via Bearer tokens, rate limited per IP
- **Health** — `/health` and `/health/ready` endpoints for load-balancer probes

---

## Architecture

```
                   Process: node (tsx server.ts)
                   ┌──────────────────────────────────────┐
                   │                                      │
                   │   Port 3000 — Remix Web UI           │
                   │   ├─ Dashboard, executions, nodes    │
                   │   ├─ Settings (envs, users, API keys)│
                   │   └─ Health: /health, /health/ready  │
                   │                                      │
                   │   Port 3100 — MCP Server (HTTP/SSE)  │
                   │   ├─ Resources: cluster://{envId}/*  │
                   │   ├─ Tools: list_executions, get_*   │
                   │   ├─ Auth: Bearer token validation   │
                   │   └─ Health: /health, /health/ready  │
                   │                                      │
                   │   Shared services                     │
                   │   ├─ DbManager — cached Postgres pools│
                   │   ├─ AuthRepository — SQLite auth.db  │
                   │   └─ ApiKeyRepository — API key store │
                   └──────────────────────────────────────┘
```

Both servers run in a **single Node.js process**, sharing the same connection pool cache (`DbManager`) and authentication database.

---

## Quick start

### Prerequisites

- Node.js >= 23
- pnpm 10.x
- A Postgres database running an Effect Cluster schema

### Install

```bash
git clone <repo-url>
cd effect-workflow-viz
pnpm install
```

### Configure environments

The app stores Postgres connection details in an SQLite database (`auth.db`). On first run, visit `http://localhost:3000` to create an admin account and configure your first environment.

Alternatively, pre-seed the database:

```bash
pnpm tsx -e "
import { ManagedRuntime, Layer, Effect } from 'effect'
import { EnvironmentRepository } from '@template/environments/EnvironmentRepository'
import { AuthRepository } from '@template/auth/AuthRepository'
import { hashPassword } from '@template/auth/password'

const rt = ManagedRuntime.make(Layer.mergeAll(AuthRepository.Default, EnvironmentRepository.Default))
await rt.runPromise(Effect.gen(function*() {
  const repo = yield* EnvironmentRepository
  yield* repo.create({
    name: 'local',
    host: 'localhost',
    port: '5432',
    user: 'postgres',
    password: 'postgres',
    dbName: 'cluster'
  })
}))
"
```

### Run

```bash
# Development (with file watching)
pnpm dev

# Production
pnpm start
```

### Verify

```bash
# Web UI
curl http://localhost:3000/health
# → {"status":"ok"}

# MCP server
curl http://localhost:3100/health
# → {"status":"ok"}
```

---

## MCP Server — resources & tools

Use the MCP server to let AI assistants inspect your Effect Cluster.

### Connect Claude Desktop

1. Generate an API key from the web UI: **Settings → API Keys → Create key**
2. Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "effect-cluster": {
      "url": "http://localhost:3100/sse",
      "headers": {
        "Authorization": "Bearer sk_your_generated_key_here"
      }
    }
  }
}
```

### Connect Claude Code (CLI)

```bash
claude mcp add --transport http effect-cluster http://localhost:3100/sse \
  -H "Authorization: Bearer sk_your_generated_key_here"
```

### Resources

| URI pattern | Description | Example |
|---|---|---|
| `cluster://{envId}/overview` | Full cluster snapshot (stats, nodes, shards, activity) | `cluster://local/overview` |
| `cluster://{envId}/nodes` | Cluster runners with health status | `cluster://local/nodes` |
| `cluster://{envId}/shards` | Shard assignment and entity counts | `cluster://local/shards` |
| `cluster://{envId}/workflow-types` | Distinct workflow names | `cluster://local/workflow-types` |
| `cluster://environments` | All configured environments | `cluster://environments` |

Resource URIs accept the **environment name** (e.g. `local`) or its UUID.

### Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_environments` | Discover available environments | _(none)_ |
| `list_executions` | List workflow runs with filters | `envId`, `limit`, `status`, `workflowName`, `traceId`, `from`, `to` |
| `get_execution` | Get a single execution | `envId`, `executionId` or `messageId` |
| `get_execution_children` | Get child runs of a parent | `envId`, `messageId` |

### Example prompts (with Claude)

Once connected, you can ask:

- *"List the workflows running on the local environment"*
- *"Show me the cluster overview for production"*
- *"What failed executions happened in the last hour?"*
- *"Give me the details of execution [messageId]"*

---

## API Key Management

API keys are stored Argon2id-hashed in the SQLite database. The raw key is shown **once** at creation.

| Action | Via UI | Via curl |
|---|---|---|
| Create | Settings → API Keys → Create key | _(UI only — key shown once)_ |
| Revoke | Settings → API Keys → Revoke | _(UI only)_ |
| Validate | `Authorization: Bearer sk_...` | `curl -H "Authorization: Bearer sk_..." ...` |

---

## Rate Limiting

The MCP server enforces a sliding-window rate limit: **100 requests per 60 seconds per IP**. Exceeded requests receive `429 Too Many Requests` with a `Retry-After: 60` header.

---

## Development

```bash
# Type-check all packages
pnpm check

# Lint
pnpm lint

# Run tests
pnpm test

# Run MCP standalone (port 3100, no web server)
pnpm --filter @template/mcp dev
```

---

## Docker

```bash
# Build
docker build -t effect-workflow-viz .

# Run (mount a volume to persist auth.db)
docker run \
  -p 3000:3000 \
  -p 3100:3100 \
  -v ./data:/app/data \
  effect-workflow-viz

# From GitHub Container Registry
docker pull ghcr.io/<your-user>/effect-workflow-viz:main
```

The Docker image is distroless (no shell, no package manager) and runs as non-root user (65532).

### GitHub Actions

On every push to `main` and tags `v*`, the CI builds and pushes the image to `ghcr.io`. Pull requests only build (no push).

---

## Project structure

```
packages/
├── api/          # REST API helpers
├── auth/         # Authentication (SQLite, Argon2id, ApiKeyRepository)
├── database/     # Postgres readers (OverviewReader, WorkflowReader)
├── domain/       # Domain types (RunSummary, RunDetail, ApiKey, …)
├── environments/ # Environment management, DbManager
├── mcp/          # MCP server (McpServer.ts, EnvReader, auth middleware)
└── web/          # Remix 3 SPA (server.ts, controllers, pages)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5 |
| Framework | Effect 3.21 (Schema, Layer, ManagedRuntime) |
| SQL | @effect/sql, @effect/sql-pg, @effect/sql-sqlite-node |
| Web UI | Remix 3, Chart.js |
| MCP | @effect/ai (McpServer, Tool, Toolkit) |
| Server | @effect/platform NodeHttpServer |
| Auth | Argon2id (oslo/password) |
| CI/CD | GitHub Actions → ghcr.io |
| Container | Distroless (gcr.io/distroless/nodejs24-debian12) |
