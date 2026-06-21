// ---------------------------------------------------------------------------
// Types for the Overview page — mirrors the shape returned by the API.
// Extracted from packages/web/app/types/overview.ts so the MCP server can
// reuse them without depending on @template/web.
// ---------------------------------------------------------------------------

/** Raw query results produced by OverviewReader.buildSnapshot() */
export interface OverviewReaderResult {
  stats: ReadonlyArray<{ status: string; count: number }>
  activity: ReadonlyArray<{ bucket: string; bucketEpochMs: string; completed: number; failed: number }>
  shardCounts: ReadonlyArray<{ shardId: string; messageCount: number }>
  entityTypes: ReadonlyArray<{ entityType: string }>
  recentCount: number
  now: Date
  activeRunners: ReadonlyArray<{
    address: string
    runner: string
    healthy: boolean
    lastHeartbeat: string
  }>
  allRunners: ReadonlyArray<{
    address: string
    runner: string
    healthy: boolean
    lastHeartbeat: string
  }>
  shardAssignments: ReadonlyArray<{
    shardId: string
    address: string
    acquiredAt: string
  }>
  maxShard: number
  shardEntities: ReadonlyArray<{
    shardId: string
    entityCount: number
  }>
}

export type NodeStatus = "healthy" | "offline"

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

export type NodeInfo = {
  /** runner address (e.g. "0.0.0.0:34431") */
  id: string
  /** display address (same as id) */
  addr: string
  /** computed from healthy + lastHeartbeat within lock expiry */
  status: NodeStatus
  /** raw groups array from runner JSON (e.g. "[default]") */
  groups: string
  /** healthy flag from cluster_runners */
  healthy: boolean
  /** last heartbeat timestamp string from cluster_runners */
  lastHeartbeat: string | null
  /** number of shards assigned to this runner via cluster_locks */
  assignedShards: number
}

export type ShardInfo = {
  /** shard id as "group:number" (e.g. "default:73") */
  id: string
  /** numeric part of the shard id */
  num: number
  /** assigned = present in cluster_locks with non-expired acquired_at */
  status: "assigned" | "unassigned"
  /** number of distinct entities seen on this shard (derived from cluster_messages), null if never messaged */
  entities: number | null
}

export type OverviewSnapshot = {
  cluster: ClusterStats
  workflows: WorkflowStats
  activity: Array<ActivityPoint>
  nodes: Array<NodeInfo>
  shards: Array<ShardInfo>
}

/**
 * Assemble an OverviewSnapshot from raw OverviewReader query results.
 * Only fields backed by real SQL columns are populated.
 */
export const buildSnapshotFromDb = (raw: OverviewReaderResult): OverviewSnapshot => {
  const {
    activeRunners,
    activity,
    allRunners,
    entityTypes,
    maxShard,
    now,
    recentCount,
    shardAssignments,
    shardEntities,
    stats
  } = raw

  // ── Workflow stats from status counts (unchanged, from cluster_messages) ──
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

  // ── Activity chart: evenly-spaced 15-min buckets over last 24h ──
  const activityMap = new Map<number, { completed: number; failed: number }>()
  for (const row of activity) {
    activityMap.set(Number(row.bucketEpochMs), { completed: row.completed, failed: row.failed })
  }

  const BUCKET_MS = 15 * 60 * 1000
  const H24_MS = 24 * 60 * 60 * 1000
  const nowMs = now.getTime()
  const startMs = nowMs - H24_MS
  const bucketCount = Math.floor(H24_MS / BUCKET_MS) // 96

  const activityPoints: Array<ActivityPoint> = []
  for (let i = 0; i < bucketCount; i++) {
    const t = startMs + i * BUCKET_MS
    const bucketEpoch = Math.floor(t / BUCKET_MS) * BUCKET_MS
    const data = activityMap.get(bucketEpoch)
    activityPoints.push({
      t: bucketEpoch,
      completed: data?.completed ?? 0,
      failed: data?.failed ?? 0
    })
  }

  // ── Cluster: active vs all runners ──────────────────────────────────────
  const LOCK_EXPIRY_MS = 35_000

  const activeRunnerAddresses = new Set<string>()
  for (const r of activeRunners) {
    if (r.healthy) {
      activeRunnerAddresses.add(r.address)
    }
  }

  const nodesUp = activeRunnerAddresses.size
  const nodesTotal = allRunners.length

  // ── Shards from cluster_locks ────────────────────────────────────────────
  const assignedShardMap = new Map<string, string>()
  const shardEntitiesMap = new Map<string, number>()

  for (const a of shardAssignments) {
    const acquiredMs = Date.parse(a.acquiredAt.replace(" ", "T"))
    if (!Number.isNaN(acquiredMs) && (nowMs - acquiredMs) < LOCK_EXPIRY_MS) {
      assignedShardMap.set(a.shardId, a.address)
    }
  }

  for (const e of shardEntities) {
    shardEntitiesMap.set(e.shardId, e.entityCount)
  }

  const SHARDS_TOTAL = maxShard
  const shards: Array<ShardInfo> = []
  for (let i = 1; i <= SHARDS_TOTAL; i++) {
    const id = `default:${i}`
    shards.push({
      id,
      num: i,
      status: assignedShardMap.has(id) ? "assigned" : "unassigned",
      entities: shardEntitiesMap.get(id) ?? null
    })
  }
  const shardsAssigned = assignedShardMap.size

  // ── Nodes from cluster_runners ────────────────────────────────────────────
  const shardsPerRunner = new Map<string, number>()
  for (const [, address] of assignedShardMap) {
    shardsPerRunner.set(address, (shardsPerRunner.get(address) ?? 0) + 1)
  }

  const nodes: Array<NodeInfo> = allRunners.map((r) => {
    const isActive = activeRunnerAddresses.has(r.address)
    let groupsStr = r.runner
    try {
      const parsed = JSON.parse(r.runner)
      if (parsed.groups) {
        groupsStr = JSON.stringify(parsed.groups)
      }
    } catch { /* use raw runner string */ }

    return {
      id: r.address,
      addr: r.address,
      status: isActive ? "healthy" : "offline",
      groups: groupsStr,
      healthy: r.healthy,
      lastHeartbeat: r.lastHeartbeat,
      assignedShards: shardsPerRunner.get(r.address) ?? 0
    }
  })

  const entitiesTotalSeen = entityTypes.length
  const msgPerSec = Math.round(recentCount / 3600)

  return {
    cluster: {
      nodesUp,
      nodesTotal,
      activeEntities: entitiesTotalSeen,
      entitiesTotal: entitiesTotalSeen,
      shardsAssigned,
      shardsTotal: SHARDS_TOTAL,
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
