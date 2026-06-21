# @template/mcp — Effect Cluster MCP Server

Read-only MCP server over the Effect Cluster observability data, reusing the
same `WorkflowReader` and `OverviewReader` factories and `Schema.Struct` output
types that the Remix UI uses.

Part of the **Effect Workflow Viz** monorepo. The MCP server runs alongside the
Remix web UI in a single process (port 3000 web, port 3100 MCP).

## Endpoint

| Protocol | URL                          | Default port |
|----------|------------------------------|--------------|
| SSE      | `http://localhost:3100/sse`  | 3100         |

Configure port and host with `MCP_PORT` and `MCP_HOST` environment variables.

## Authentication

API keys are managed via the web UI (Settings → API Keys). The middleware
validates `Authorization: Bearer <key>` against the Argon2id-hashed keys stored
in the SQLite database. Rate limiting: 100 req / 60s per IP.

## Resources

| URI pattern | Description |
|---|---|
| `cluster://environments` | All configured environments (auto-discovery) |
| `cluster://{envId}/overview` | Full cluster overview snapshot (stats, workflows, nodes, shards, activity) |
| `cluster://{envId}/nodes` | List of cluster nodes/runners with health |
| `cluster://{envId}/shards` | List of shards with assignment status |
| `cluster://{envId}/workflow-types` | Distinct workflow (entity) types observed |

The `envId` parameter accepts either the environment **name** (e.g. `local`, `production`)
or its UUID — whichever is more convenient.

## Tools

| Tool | Description | Parameters |
|---|---|---|
| `list_environments` | Discover available environments | _(none)_ |
| `list_executions` | List workflow executions with optional filters | `envId`, `limit` (max 200), `before`, `status[]`, `workflowName`, `traceId`, `from`, `to` |
| `get_execution` | Get a single execution by `executionId` (entity_id) or `messageId` | `envId`, `executionId` or `messageId` |
| `get_execution_children` | Get child executions for a parent `messageId` | `envId`, `messageId` |

All tools return data shaped by the same `RunSummary` / `RunDetail` Schema.Classes
used in the Remix UI. No mutation tools are exposed.

## Health

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness — always 200 |
| `GET /health/ready` | Readiness — 200 when Postgres is reachable |

Health endpoints bypass rate limiting and authentication.

## Example MCP client configuration (Claude Desktop)

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

## Claude Code (CLI)

```bash
claude mcp add --transport http effect-cluster http://localhost:3100/sse \
  -H "Authorization: Bearer sk_your_generated_key_here"
```

## Example prompts

- *"List the workflows running on the local environment"*
- *"Show me the cluster overview for production and tell me if any nodes are unhealthy"*
- *"What failed executions happened in the last hour?"*
- *"Give me the details of execution [messageId]"*

## Development

```bash
# Standalone MCP server (port 3100, no web UI)
pnpm dev

# Inside the monorepo (both web + MCP on ports 3000 + 3100)
cd .. && pnpm dev
```
