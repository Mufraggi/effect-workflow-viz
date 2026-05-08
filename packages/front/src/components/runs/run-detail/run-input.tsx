import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useMemo, useState } from "react"

const TRUNCATE_CHARS = 500
const HUGE_BYTES = 50 * 1024

export const RunInput = ({ input }: { input: unknown }) => {
  const [expanded, setExpanded] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const formatted = useMemo(() => {
    if (input === null || input === undefined) return null
    try {
      return JSON.stringify(input, null, 2)
    } catch {
      return String(input)
    }
  }, [input])

  if (formatted === null) {
    return <p className="text-sm text-muted-foreground">—</p>
  }

  const bytes = formatted.length

  if (bytes > HUGE_BYTES) {
    return (
      <>
        <HugeSummary input={input} bytes={bytes} onOpen={() => setViewerOpen(true)} />
        <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Input viewer</DialogTitle>
              <DialogDescription>{formatBytes(bytes)} of JSON</DialogDescription>
            </DialogHeader>
            <pre className="max-h-[65vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
              {formatted}
            </pre>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  if (bytes <= TRUNCATE_CHARS || expanded) {
    return (
      <div className="space-y-1.5">
        <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs">
          {formatted}
        </pre>
        {bytes > TRUNCATE_CHARS && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ▾ Hide full input
          </button>
        )}
      </div>
    )
  }

  const head = formatted.split("\n").slice(0, 3).join("\n")
  return (
    <div className="space-y-1.5">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">{head}</pre>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ▸ Show full input ({formatBytes(bytes)})
      </button>
    </div>
  )
}

const HugeSummary = ({
  bytes,
  input,
  onOpen
}: {
  input: unknown
  bytes: number
  onOpen: () => void
}) => {
  const keys = typeof input === "object" && input !== null && !Array.isArray(input)
    ? Object.keys(input)
    : []
  const summary = keys.length > 0
    ? `${keys.length} top-level keys: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "…" : ""}`
    : Array.isArray(input)
    ? `Array with ${input.length} items`
    : "scalar value"
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
      <div className="min-w-0">
        <div className="font-medium">Input: {formatBytes(bytes)} JSON</div>
        <div className="text-xs text-muted-foreground">{summary}</div>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md border border-border bg-background px-3 py-1 text-xs hover:bg-muted"
      >
        Open in viewer
      </button>
    </div>
  )
}

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)}KB`
  return `${(n / 1024 / 1024).toFixed(1)}MB`
}
