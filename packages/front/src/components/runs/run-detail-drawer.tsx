import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { ApiClient } from "@/lib/ApiClient"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { MessageId } from "@template/domain/run/MessageId"
import type { RunDetail } from "@template/domain/run/RunDetail"
import type { RunSummary } from "@template/domain/run/RunSummary"
import { StatusBadge } from "./status-badge.js"

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "medium"
})

const truncate = (s: string, n: number) => (s.length <= n + 3 ? s : `${s.slice(0, n)}…`)

export const RunDetailDrawer = ({
  messageId,
  onOpenChange
}: {
  messageId: MessageId | null
  onOpenChange: (open: boolean) => void
}) => (
  <Drawer open={messageId !== null} onOpenChange={onOpenChange} direction="right">
    <DrawerContent className="overflow-y-auto sm:max-w-md">
      {messageId !== null
        ? <RunDetailBody messageId={messageId} />
        : null}
    </DrawerContent>
  </Drawer>
)

const RunDetailBody = ({ messageId }: { messageId: MessageId }) => {
  const result = useAtomValue(
    ApiClient.query("runs", "getRun", {
      path: { messageId },
      reactivityKeys: ["runs.detail", messageId]
    })
  )

  return Result.matchWithError(result, {
    onInitial: () => (
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    ),
    onError: (e) => (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        {e._tag === "RunNotFound" ? "Run not found." : `Failed to load run: ${String(e)}`}
      </div>
    ),
    onDefect: (d) => (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
        Defect: {String(d)}
      </div>
    ),
    onSuccess: (s) => <RunDetailContent run={s.value} />
  })
}

const RunDetailContent = ({ run }: { run: RunDetail }) => (
  <>
    <DrawerHeader className="px-0">
      <DrawerTitle className="font-serif text-xl">{run.workflowName}</DrawerTitle>
      <DrawerDescription className="font-mono text-xs">{run.runId}</DrawerDescription>
    </DrawerHeader>

    <Section title="Status">
      <StatusBadge status={run.status} />
    </Section>

    <Section title="Identifiers">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
        <Field label="Message ID" value={String(run.id)} mono />
        <Field label="Trace ID" value={run.traceId ? String(run.traceId) : "—"} mono />
        <Field label="Shard" value={String(run.shardId)} mono />
        <Field
          label="Started"
          value={run.startedAtProxy ? dateFmt.format(run.startedAtProxy) : "—"}
        />
      </dl>
    </Section>

    <Section title="Input">
      <JsonBlock value={run.input} />
    </Section>

    <Section title="Output">
      <JsonBlock value={run.output} />
    </Section>

    <Section title={`Children (${run.children.length})`}>
      {run.children.length === 0
        ? <p className="text-sm text-muted-foreground">No child runs.</p>
        : (
          <ul className="space-y-1.5">
            {run.children.map((child) => <ChildRow key={String(child.id)} child={child} />)}
          </ul>
        )}
    </Section>
  </>
)

const Section = ({ children, title }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </section>
)

const Field = ({
  label,
  mono,
  value
}: {
  label: string
  value: string
  mono?: boolean
}) => (
  <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={mono ? "font-mono break-all" : "tabular-nums"}>{value}</dd>
  </>
)

const JsonBlock = ({ value }: { value: unknown }) =>
  value === null || value === undefined
    ? <p className="text-sm text-muted-foreground">—</p>
    : (
      <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    )

const ChildRow = ({ child }: { child: RunSummary }) => (
  <li className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2 text-sm">
    <div className="min-w-0 flex-1">
      <div className="font-medium truncate">{child.workflowName}</div>
      <div className="font-mono text-xs text-muted-foreground">
        {truncate(String(child.runId), 16)}
      </div>
    </div>
    <StatusBadge status={child.status} />
  </li>
)
