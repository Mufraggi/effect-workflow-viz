// ---------------------------------------------------------------------------
// Re-export types and builder from the database package, where they now live
// so both the Remix web app and the MCP server can share them.
// ---------------------------------------------------------------------------
export type {
  ActivityPoint,
  ClusterStats,
  NodeInfo,
  NodeStatus,
  OverviewReaderResult,
  OverviewSnapshot,
  ShardInfo,
  WorkflowStats
} from "@template/database/repository/overviewReader/snapshot"

export { buildSnapshotFromDb } from "@template/database/repository/overviewReader/snapshot"
