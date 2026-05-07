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
