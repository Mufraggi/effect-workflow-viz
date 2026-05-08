export type ExitTag = "Success" | "Failure"

export type CauseRoot = "Fail" | "Die" | "Interrupt" | "Empty"

const isObject = (u: unknown): u is Record<string, unknown> => typeof u === "object" && u !== null

export const decodeExitTag = (json: unknown): ExitTag | null => {
  if (!isObject(json)) return null
  const tag = json["_tag"]
  return tag === "Success" || tag === "Failure" ? tag : null
}

export const decodeCauseRoot = (cause: unknown): CauseRoot | null => {
  if (!isObject(cause)) return null
  const tag = cause["_tag"]
  if (tag === "Fail" || tag === "Die" || tag === "Interrupt" || tag === "Empty") {
    return tag
  }
  if (tag === "Sequential" || tag === "Parallel") {
    return decodeCauseRoot(cause["left"]) ?? decodeCauseRoot(cause["right"])
  }
  return null
}

export type CauseLeafTag = "Fail" | "Die" | "Interrupt"

/**
 * Walk a Cause tree (depth-first, left first) and return the first leaf node
 * matching the given tag. Returns the raw object so callers can read its data
 * (`error` for Fail, `defect` for Die, `fiberId` for Interrupt).
 */
export const findCauseLeaf = (
  cause: unknown,
  tag: CauseLeafTag
): Record<string, unknown> | null => {
  if (!isObject(cause)) return null
  const t = cause["_tag"]
  if (t === tag) return cause
  if (t === "Sequential" || t === "Parallel") {
    return findCauseLeaf(cause["left"], tag) ?? findCauseLeaf(cause["right"], tag)
  }
  return null
}
