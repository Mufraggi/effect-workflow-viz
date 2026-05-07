import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { RunStatus } from "@template/domain/run/RunStatus"

const styles: Record<RunStatus, string> = {
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  pending: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  failed_app: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  crashed: "bg-red-700/20 text-red-800 dark:text-red-300 border-red-700/40",
  interrupted: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  unknown: "bg-zinc-500/10 text-muted-foreground border-zinc-500/20"
}

export const StatusBadge = ({ status }: { status: RunStatus }) => (
  <Badge
    variant="outline"
    className={cn("font-mono uppercase tracking-wide text-[10px]", styles[status])}
  >
    {status}
  </Badge>
)
