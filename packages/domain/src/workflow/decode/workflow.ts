const isObject = (u: unknown): u is Record<string, unknown> => typeof u === "object" && u !== null

/**
 * For a workflow run, the Cluster Exit's `value` field carries a WorkflowResult
 * shaped as `{ _tag: "Complete", exit: <inner Exit> }`. This returns the inner
 * Exit, or null if the input is not a workflow Complete result.
 */
export const unwrapWorkflowResult = (clusterExitValue: unknown): unknown | null => {
  if (!isObject(clusterExitValue)) return null
  if (clusterExitValue["_tag"] !== "Complete") return null
  return clusterExitValue["exit"] ?? null
}
