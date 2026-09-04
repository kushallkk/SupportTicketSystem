import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ticket-badges";
import { timeAgo } from "@/lib/ticket-display";
import type { TicketDetail } from "@/hooks/use-ticket";

export function TicketHeader({ ticket, basePath }: { ticket: TicketDetail; basePath: string }) {
  return (
    <div className="space-y-4">
      <Link href={basePath} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status as never} />
          <PriorityBadge priority={ticket.priority as never} />
          {ticket.category && (
            <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
              {ticket.category.name}
            </span>
          )}
        </div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{ticket.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Raised by {ticket.raisedBy.name}</span>
          <span>·</span>
          <span>{timeAgo(ticket.createdAt)}</span>
          <span>·</span>
          <span>Assigned to {ticket.assignedTo?.name ?? "Unassigned"}</span>
        </div>
      </div>

      <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm">{ticket.description}</p>
    </div>
  );
}
