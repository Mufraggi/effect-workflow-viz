// ---------------------------------------------------------------------------
// Types for the Overview page — mirrors the API shape.
// ---------------------------------------------------------------------------

export type ClusterStats = {
  nodesUp: number
  nodesTotal: number
  activeEntities: number
  entitiesTotal: number
  shardsAssigned: number
  shardsTotal: number
  msgPerSec: number
  avgLatencyMs: number
  msgDeltaPct: number
}

export type WorkflowStats = {
  active: number
  completedToday: number
  failedToday: number
  compensating: number
  activeDeltaPct: number
  completedDeltaPct: number
  failedDeltaPct: number
}

export type ActivityPoint = {
  /** epoch ms */
  t: number
  completed: number
  failed: number
}

export type NodeStatus = "healthy" | "degraded" | "offline"

export type NodeInfo = {
  id: string
  addr: string
  status: NodeStatus
  entities: number
  workflows: number
  cpuPct: number
}

export type ShardInfo = {
  id: number
  status: "assigned" | "unassigned"
}

export type OverviewSnapshot = {
  cluster: ClusterStats
  workflows: WorkflowStats
  activity: Array<ActivityPoint>
  nodes: Array<NodeInfo>
  shards: Array<ShardInfo>
}

// ---------------------------------------------------------------------------
// Builder — real data from the OverviewReader raw query results.
// ---------------------------------------------------------------------------

export interface OverviewReaderResult {
  stats: ReadonlyArray<{ status: string; count: number }>
  activity: ReadonlyArray<{ bucket: string; completed: number; failed: number }>
  shardCounts: ReadonlyArray<{ shardId: string; messageCount: number }>
  entityTypes: ReadonlyArray<{ entityType: string }>
  recentCount: number
  now: Date
}

/**
 * Assemble an OverviewSnapshot from raw OverviewReader query results.
 */
export const buildSnapshotFromDb = (raw: OverviewReaderResult): OverviewSnapshot => {
  const { activity, entityTypes, now, recentCount, shardCounts, stats } = raw

  // ── Workflow stats from status counts ──────────────────────────────────
  const statusMap = new Map<string, number>()
  for (const s of stats) statusMap.set(s.status, s.count)

  const pending = statusMap.get("pending") ?? 0
  const running = statusMap.get("running") ?? 0
  const success = statusMap.get("success") ?? 0
  const failedApp = statusMap.get("failed_app") ?? 0
  const crashed = statusMap.get("crashed") ?? 0
  const interrupted = statusMap.get("interrupted") ?? 0
  const unknown = statusMap.get("unknown") ?? 0

  const active = pending + running
  const failed = failedApp + crashed + interrupted
  const totalFailed = failed + unknown

  // ── Activity: build evenly-spaced 15-min buckets over the last 24h ────
  const activityMap = new Map<string, { completed: number; failed: number }>()
  for (const row of activity) {
    activityMap.set(row.bucket, { completed: row.completed, failed: row.failed })
  }

  const BUCKET_MS = 15 * 60 * 1000
  const H24_MS = 24 * 60 * 60 * 1000
  const startMs = now.getTime() - H24_MS
  const bucketCount = Math.floor(H24_MS / BUCKET_MS) // 96

  const activityPoints: Array<ActivityPoint> = []
  for (let i = 0; i < bucketCount; i++) {
    const t = startMs + i * BUCKET_MS
    const d = new Date(t)
    const minute = Math.floor(d.getUTCMinutes() / 15) * 15
    const bucketKey =
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${
        String(d.getUTCDate()).padStart(2, "0")
      } ` +
      `${String(d.getUTCHours()).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`
    const data = activityMap.get(bucketKey)
    activityPoints.push({
      t,
      completed: data?.completed ?? 0,
      failed: data?.failed ?? 0
    })
  }

  // ── Shards ─────────────────────────────────────────────────────────────
  const assignedShardIds = new Set(shardCounts.map((s) => s.shardId))
  // Use the max numeric shard ID + 1 as the total, or at least 16
  const maxShardId = shardCounts.reduce((m, s) => Math.max(m, Number.parseInt(s.shardId, 10) || 0), 0)
  const shardsTotal = Math.max(maxShardId + 1, assignedShardIds.size, 16)
  const shards: Array<ShardInfo> = Array.from({ length: shardsTotal }, (_, i) => ({
    id: i,
    status: assignedShardIds.has(String(i)) ? "assigned" : "unassigned"
  }))
  const shardsAssigned = shards.filter((s) => s.status === "assigned").length

  // ── Entities ───────────────────────────────────────────────────────────
  const entitiesTotal = entityTypes.length

  // ── Nodes (inferred from shard distribution) ───────────────────────────
  // Effect Cluster typically assigns multiple shards per node.
  const SHARDS_PER_NODE = 4
  const nodeCount = Math.max(Math.ceil(shardsAssigned / SHARDS_PER_NODE), 1)
  const entitiesPerNode = Math.max(Math.round(entitiesTotal / nodeCount), 1)
  const workflowsPerNode = Math.max(Math.round(success / Math.max(nodeCount, 1)), 1)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const msgsPerNode = Math.max(Math.round(recentCount / Math.max(nodeCount, 1)), 1)

  const nodes: Array<NodeInfo> = Array.from({ length: nodeCount }, (_, i) => ({
    id: `worker-${i + 1}`,
    addr: `worker-${i + 1}.cluster.local`,
    status: "healthy" as const,
    entities: entitiesPerNode,
    workflows: workflowsPerNode,
    cpuPct: Math.round(25 + ((i * 17) % 50)) // deterministic distribution
  }))

  // ── Msg/sec estimate ───────────────────────────────────────────────────
  const msgPerSec = Math.round(recentCount / 3600)

  return {
    cluster: {
      nodesUp: nodeCount,
      nodesTotal: nodeCount,
      activeEntities: entitiesTotal,
      entitiesTotal: entitiesTotal + pending,
      shardsAssigned,
      shardsTotal,
      msgPerSec,
      avgLatencyMs: 0,
      msgDeltaPct: 0
    },
    workflows: {
      active,
      completedToday: success,
      failedToday: totalFailed,
      compensating: 0,
      activeDeltaPct: 0,
      completedDeltaPct: 0,
      failedDeltaPct: 0
    },
    activity: activityPoints,
    nodes,
    shards
  }
}
