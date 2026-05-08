import { decodeExitTag } from "./exit.js"

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

/**
 * Extract the failure Cause from a workflow run output. Handles both shapes:
 *  - outer Failure: returns `output.cause`
 *  - outer Success wrapping a workflow Complete with an inner Failure:
 *    returns `output.value.exit.cause`
 * Returns null when the run did not fail.
 */
export const getOutputCause = (output: unknown): unknown | null => {
  if (!isObject(output)) return null
  const tag = decodeExitTag(output)
  if (tag === "Failure") return output["cause"] ?? null
  if (tag === "Success") {
    const inner = unwrapWorkflowResult(output["value"])
    if (!isObject(inner)) return null
    if (decodeExitTag(inner) === "Failure") return inner["cause"] ?? null
  }
  return null
}
