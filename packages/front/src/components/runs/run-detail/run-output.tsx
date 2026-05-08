import { cn } from "@/lib/utils"
import type { RunDetail } from "@template/domain/run/RunDetail"
import { findCauseLeaf } from "@template/domain/workflow/decode/exit"
import { getOutputCause } from "@template/domain/workflow/decode/workflow"
import { useState } from "react"

export const RunOutput = ({ run }: { run: RunDetail }) => {
  switch (run.status) {
    case "success":
      return <SuccessView output={run.output} />
    case "failed_app":
      return <FailedAppView output={run.output} />
    case "crashed":
      return <CrashedView output={run.output} />
    case "interrupted":
      return <InterruptedView output={run.output} />
    case "pending":
    case "running":
      return <Muted>{run.status === "pending" ? "Not started yet." : "Still running."}</Muted>
    case "unknown":
      return <RawDisclosure label="Show raw output" value={run.output} defaultOpen />
  }
}

const Muted = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
)

const SuccessView = ({ output }: { output: unknown }) => (
  <div className="space-y-2">
    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
      ✓ Completed successfully
    </p>
    <RawDisclosure label="Show raw exit" value={output} />
  </div>
)

const FailedAppView = ({ output }: { output: unknown }) => {
  const cause = getOutputCause(output)
  const fail = cause === null ? null : findCauseLeaf(cause, "Fail")
  const errMessage = fail !== null ? extractMessage(fail["error"]) : null

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm">
        <div className="font-medium text-red-700 dark:text-red-400">Application error</div>
        {errMessage && (
          <div className="mt-1 font-mono text-xs whitespace-pre-wrap break-words">
            {errMessage}
          </div>
        )}
      </div>
      <RawDisclosure label="Show raw cause" value={cause ?? output} />
    </div>
  )
}

const CrashedView = ({ output }: { output: unknown }) => {
  const cause = getOutputCause(output)
  const die = cause === null ? null : findCauseLeaf(cause, "Die")
  const defect = die?.["defect"]
  const { message, name, stack } = extractDefect(defect)

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-red-700/40 bg-red-700/5 p-3 text-sm">
        <div className="font-mono text-xs uppercase tracking-wide text-red-700 dark:text-red-300">
          {name ?? "Defect"}
        </div>
        {message && (
          <div className="mt-1 font-mono text-xs whitespace-pre-wrap break-words text-red-800 dark:text-red-200">
            {message}
          </div>
        )}
      </div>
      {stack && <RawDisclosure label="Show stack" value={stack} preformatted />}
      <RawDisclosure label="Show raw cause" value={cause ?? output} />
    </div>
  )
}

const InterruptedView = ({ output }: { output: unknown }) => {
  const cause = getOutputCause(output)
  const interrupt = cause === null ? null : findCauseLeaf(cause, "Interrupt")
  const fiberId = interrupt?.["fiberId"]
  const fiberLabel = formatFiberId(fiberId)

  return (
    <div className="space-y-2">
      <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3 text-sm">
        <div className="font-medium text-orange-700 dark:text-orange-400">Interrupted</div>
        {fiberLabel && (
          <div className="mt-1 font-mono text-xs text-orange-800 dark:text-orange-200">
            fiber {fiberLabel}
          </div>
        )}
      </div>
      <RawDisclosure label="Show raw cause" value={cause ?? output} />
    </div>
  )
}

const RawDisclosure = ({
  defaultOpen,
  label,
  preformatted,
  value
}: {
  label: string
  value: unknown
  defaultOpen?: boolean
  preformatted?: boolean
}) => {
  const [open, setOpen] = useState(defaultOpen ?? false)
  if (value === null || value === undefined) return null
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-muted-foreground hover:text-foreground transition"
      >
        {open ? "▾" : "▸"} {label}
      </button>
      {open && (
        <pre
          className={cn(
            "mt-1.5 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs",
            !preformatted && "whitespace-pre"
          )}
        >
          {preformatted && typeof value === "string" ? value : JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  )
}

const extractMessage = (err: unknown): string | null => {
  if (err === null || err === undefined) return null
  if (typeof err === "string") return err
  if (typeof err === "object") {
    const message = (err as Record<string, unknown>)["message"]
    if (typeof message === "string") return message
    return JSON.stringify(err, null, 2)
  }
  return String(err)
}

const extractDefect = (defect: unknown): {
  name: string | null
  message: string | null
  stack: string | null
} => {
  if (defect === null || defect === undefined) return { name: null, message: null, stack: null }
  if (typeof defect === "string") return { name: null, message: defect, stack: null }
  if (typeof defect === "object") {
    const obj = defect as Record<string, unknown>
    return {
      name: typeof obj["name"] === "string" ? (obj["name"] as string) : null,
      message: typeof obj["message"] === "string" ? (obj["message"] as string) : null,
      stack: typeof obj["stack"] === "string" ? (obj["stack"] as string) : null
    }
  }
  return { name: null, message: String(defect), stack: null }
}

const formatFiberId = (fiberId: unknown): string | null => {
  if (fiberId === null || fiberId === undefined) return null
  if (typeof fiberId !== "object") return String(fiberId)
  const obj = fiberId as Record<string, unknown>
  if (typeof obj["id"] === "number") return `#${obj["id"]}`
  if (obj["_tag"] === "Composite") return "<composite>"
  return null
}
