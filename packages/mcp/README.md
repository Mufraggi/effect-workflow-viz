# @template/mcp — Effect Cluster MCP Server

Read-only MCP server over the Effect Cluster observability data, reusing the
same `WorkflowReader` and `OverviewReader` factories and `Schema.Struct` output
types that the Remix UI uses.

## Endpoint

| Protocol | URL                          | Default port |
|----------|------------------------------|--------------|
| SSE      | `http://localhost:3100/sse`  | 3100         |

Configure port and host with `MCP_PORT` and `MCP_HOST` environment variables.

## Authentication

Set `MCP_API_KEY` to a bearer token. Requests must include
`Authorization: Bearer <key>`. If unset, all requests pass through.

## Resources

| URI pattern                                | Description                                    |
|--------------------------------------------|------------------------------------------------|
| `cluster://{envId}/overview`               | Full cluster overview snapshot (stats, workflows, nodes, shards, activity) |
| `cluster://{envId}/nodes`                  | List of cluster nodes/runners with health      |
| `cluster://{envId}/shards`                 | List of shards with assignment status          |
| `cluster://{envId}/workflow-types`         | Distinct workflow (entity) types observed      |

Each resource requires `envId` as a path parameter (e.g. `cluster://prod/overview`).

## Tools

| Name                      | Description                                    | Key parameters |
|---------------------------|------------------------------------------------|----------------|
| `list_executions`         | List workflow executions with optional filters | `envId` (required), `limit`, `before`, `status`, `workflowName`, `traceId`, `from`, `to` |
| `get_execution`           | Get a single execution by `executionId` or `messageId` | `envId` (required), `executionId` or `messageId` |
| `get_execution_children`  | Get child executions for a parent `messageId` | `envId` (required), `messageId` (required) |

All tools return data shaped by the same `RunSummary` / `RunDetail` Schema.Classes
used in the Remix UI. No mutation tools are exposed.

## Example MCP client configuration (Claude Desktop)

```json
{
  "mcpServers": {
    "effect-cluster": {
      "url": "http://localhost:3100/sse",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

## Development

```bash
# Start in dev mode (auto-reload with tsx)
pnpm dev

# Build
pnpm build

# Start production build
pnpm start
```
