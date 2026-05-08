import { Skeleton } from "@/components/ui/skeleton"
import { ApiClient } from "@/lib/ApiClient"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import type { MessageId } from "@template/domain/run/MessageId"
import { ChildrenSection } from "./children-section.js"
import { RunHeader } from "./run-header.js"
import { RunInput } from "./run-input.js"
import { RunOutput } from "./run-output.js"

export const RunDetailView = ({ messageId }: { messageId: MessageId }) => {
  const result = useAtomValue(
    ApiClient.query("runs", "getRun", {
      path: { messageId },
      reactivityKeys: ["runs.detail", messageId]
    })
  )

  return Result.matchWithError(result, {
    onInitial: () => (
      <div className="space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-32 w-full" />
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
    onSuccess: (s) => (
      <div className="space-y-6">
        <RunHeader run={s.value} />

        <Section title="Output">
          <RunOutput run={s.value} />
        </Section>

        <Section title="Input">
          <RunInput input={s.value.input} />
        </Section>

        <Section title="Children">
          <ChildrenSection run={s.value} />
        </Section>
      </div>
    )
  })
}

const Section = ({ children, title }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
    {children}
  </section>
)
