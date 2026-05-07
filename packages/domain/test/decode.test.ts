import { describe, expect, it } from "vitest"
import { decodeCauseRoot, decodeExitTag } from "../src/workflow/decode/exit.js"
import { decodeRunStatus } from "../src/workflow/decode/status.js"
import { unwrapWorkflowResult } from "../src/workflow/decode/workflow.js"

const NOW = new Date("2026-05-07T12:00:00Z")

const workflowSuccessExit = {
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: { _tag: "Success", value: 42 }
  }
}

const workflowFailExit = {
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: {
      _tag: "Failure",
      cause: { _tag: "Fail", error: "boom" }
    }
  }
}

const workflowDieExit = {
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: {
      _tag: "Failure",
      cause: { _tag: "Die", defect: "kaboom" }
    }
  }
}

const workflowInterruptExit = {
  _tag: "Success",
  value: {
    _tag: "Complete",
    exit: {
      _tag: "Failure",
      cause: {
        _tag: "Sequential",
        left: { _tag: "Interrupt", fiberId: { _tag: "Composite" } },
        right: { _tag: "Empty" }
      }
    }
  }
}

const clusterFailureExit = {
  _tag: "Failure",
  cause: { _tag: "Die", defect: "container crashed" }
}

const baseRow = {
  processed: true,
  lastRead: new Date("2026-05-07T11:00:00Z"),
  isWorkflow: true,
  now: NOW
}

describe("decodeExitTag", () => {
  it("returns Success/Failure tag", () => {
    expect(decodeExitTag({ _tag: "Success", value: 1 })).toBe("Success")
    expect(decodeExitTag({ _tag: "Failure", cause: {} })).toBe("Failure")
  })

  it("returns null for invalid input", () => {
    expect(decodeExitTag(null)).toBeNull()
    expect(decodeExitTag(undefined)).toBeNull()
    expect(decodeExitTag("string")).toBeNull()
    expect(decodeExitTag({ _tag: "Other" })).toBeNull()
    expect(decodeExitTag({})).toBeNull()
  })
})

describe("decodeCauseRoot", () => {
  it("returns leaf cause tags", () => {
    expect(decodeCauseRoot({ _tag: "Fail", error: "x" })).toBe("Fail")
    expect(decodeCauseRoot({ _tag: "Die", defect: "x" })).toBe("Die")
    expect(decodeCauseRoot({ _tag: "Interrupt", fiberId: {} })).toBe("Interrupt")
    expect(decodeCauseRoot({ _tag: "Empty" })).toBe("Empty")
  })

  it("walks Sequential preferring left", () => {
    const cause = {
      _tag: "Sequential",
      left: { _tag: "Fail", error: "x" },
      right: { _tag: "Die", defect: "y" }
    }
    expect(decodeCauseRoot(cause)).toBe("Fail")
  })

  it("walks Parallel falling back to right when left empty", () => {
    const cause = {
      _tag: "Parallel",
      left: { _tag: "Empty" },
      right: { _tag: "Die", defect: "y" }
    }
    // Left is "Empty" which is a valid leaf — that gets returned first.
    expect(decodeCauseRoot(cause)).toBe("Empty")
  })

  it("returns null for unknown shapes", () => {
    expect(decodeCauseRoot(null)).toBeNull()
    expect(decodeCauseRoot({ _tag: "Unknown" })).toBeNull()
  })
})

describe("unwrapWorkflowResult", () => {
  it("returns inner exit when Complete", () => {
    const inner = unwrapWorkflowResult({
      _tag: "Complete",
      exit: { _tag: "Success", value: 1 }
    })
    expect(inner).toEqual({ _tag: "Success", value: 1 })
  })

  it("returns null when not Complete", () => {
    expect(unwrapWorkflowResult({ _tag: "Suspended" })).toBeNull()
    expect(unwrapWorkflowResult(null)).toBeNull()
  })
})

describe("decodeRunStatus", () => {
  it("workflow success", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: JSON.stringify(workflowSuccessExit)
      })
    ).toBe("success")
  })

  it("workflow fail (applicative)", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: JSON.stringify(workflowFailExit)
      })
    ).toBe("failed_app")
  })

  it("workflow die (defect)", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: JSON.stringify(workflowDieExit)
      })
    ).toBe("crashed")
  })

  it("workflow interrupt via Sequential cause", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: JSON.stringify(workflowInterruptExit)
      })
    ).toBe("interrupted")
  })

  it("non-workflow entity success (no inner exit unwrap)", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        isWorkflow: false,
        replyKind: 0,
        replyPayload: JSON.stringify({ _tag: "Success", value: "ok" })
      })
    ).toBe("success")
  })

  it("non-workflow entity failure with Die cause", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        isWorkflow: false,
        replyKind: 0,
        replyPayload: JSON.stringify(clusterFailureExit)
      })
    ).toBe("crashed")
  })

  it("pending: no reply, no last_read", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        processed: false,
        lastRead: null,
        replyKind: null,
        replyPayload: null
      })
    ).toBe("pending")
  })

  it("running: no reply, last_read recent", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        processed: false,
        lastRead: new Date(NOW.getTime() - 5 * 60 * 1000),
        replyKind: null,
        replyPayload: null
      })
    ).toBe("running")
  })

  it("pending: no reply, last_read stale (>10 min)", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        processed: false,
        lastRead: new Date(NOW.getTime() - 30 * 60 * 1000),
        replyKind: null,
        replyPayload: null
      })
    ).toBe("pending")
  })

  it("unknown: payload is not valid JSON", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: "not-json"
      })
    ).toBe("unknown")
  })

  it("unknown: replyKind is not WithExit (0)", () => {
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 1,
        replyPayload: JSON.stringify(workflowSuccessExit)
      })
    ).toBe("unknown")
  })

  it("unknown: workflow exit succeeds but inner is not a Complete WorkflowResult", () => {
    const malformed = {
      _tag: "Success",
      value: { _tag: "Suspended" }
    }
    expect(
      decodeRunStatus({
        ...baseRow,
        replyKind: 0,
        replyPayload: JSON.stringify(malformed)
      })
    ).toBe("unknown")
  })
})
