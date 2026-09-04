import { Sparkles, GitMerge } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { TicketDetail } from "@/hooks/use-ticket";

export function AiPanel({ ticket }: { ticket: TicketDetail }) {
  if (!ticket.aiCategory && !ticket.aiConfidence) return null;

  return (
    <div className="space-y-2 rounded-xl border bg-accent/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-accent-foreground">
        <Sparkles className="size-4" />
        AI classification
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">Predicted category</p>
          <p className="font-medium">{ticket.aiCategory ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Predicted priority</p>
          <p className="font-medium">{ticket.aiPriority ?? "—"}</p>
        </div>
        {ticket.aiConfidence != null && (
          <div>
            <p className="text-xs text-muted-foreground">Confidence</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress value={ticket.aiConfidence * 100} className="h-1.5" />
              <span className="text-xs font-medium">{Math.round(ticket.aiConfidence * 100)}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DuplicateBanner({
  ticket,
  basePath,
  onSelfResolve,
  showSelfResolve,
}: {
  ticket: TicketDetail;
  basePath: string;
  onSelfResolve?: () => void;
  showSelfResolve?: boolean;
}) {
  if (!ticket.duplicateOf) return null;

  return (
    <div className="space-y-3 rounded-xl border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400">
        <GitMerge className="size-4" />
        Looks similar to an existing ticket
        {ticket.similarityScore != null && (
          <span className="ml-auto rounded-full bg-purple-500/15 px-2 py-0.5 text-xs">
            {Math.round(ticket.similarityScore * 100)}% match
          </span>
        )}
      </div>
      <Link href={`${basePath}/${ticket.duplicateOf.id}`} className="block text-sm font-medium hover:underline">
        {ticket.duplicateOf.title}
      </Link>
      {ticket.duplicateOf.resolutionNote && (
        <p className="rounded-lg bg-background/60 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Resolved with: </span>
          {ticket.duplicateOf.resolutionNote}
        </p>
      )}
      {showSelfResolve && (
        <Button size="sm" variant="outline" onClick={onSelfResolve}>
          Mark my ticket resolved using this fix
        </Button>
      )}
    </div>
  );
}
