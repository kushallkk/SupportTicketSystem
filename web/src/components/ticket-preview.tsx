"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  PlayCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { PriorityBadge, StatusBadge } from "@/components/ticket-badges";
import { useTicket, type TicketDetail } from "@/hooks/use-ticket";
import { initials, timeAgo } from "@/lib/ticket-display";

type Role = "USER" | "AGENT" | "ADMIN";

export function PropertyList({ ticket }: { ticket: TicketDetail }) {
  const rows: [string, React.ReactNode][] = [
    ["Category", ticket.category?.name ?? "Uncategorized"],
    ["Assigned to", ticket.assignedTo?.name ?? "Unassigned"],
    ["Raised by", ticket.raisedBy.name],
    ["Created", timeAgo(ticket.createdAt)],
    ["Updated", timeAgo(ticket.updatedAt)],
  ];
  return (
    <dl className="space-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="truncate text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailsCard({ ticket }: { ticket: TicketDetail }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-soft)] ring-1 ring-foreground/5">
      <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Details</h3>
      <PropertyList ticket={ticket} />
    </section>
  );
}

/** The right-hand column of the 3-column viewport when a ticket is selected in the feed. */
export function TicketPreview({
  ticketId,
  role,
  basePath,
  rooms,
}: {
  ticketId: string;
  role: Role;
  basePath: string;
  rooms: string[];
}) {
  const { ticket, loading, notFound, refetch } = useTicket(ticketId, rooms);
  const [working, setWorking] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [note, setNote] = useState("");

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }
  if (notFound || !ticket) {
    return <p className="p-5 text-sm text-muted-foreground">This ticket is no longer available.</p>;
  }

  const canWork = role !== "USER";
  const fullHref = `${basePath}/${ticket.id}`;
  const comments = ticket.comments.slice(-3).reverse();

  async function patch(body: Record<string, unknown>, success: string) {
    setWorking(true);
    const res = await fetch(`/api/tickets/${ticketId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setWorking(false);
    if (!res.ok) {
      toast.error("Couldn't update ticket");
      return false;
    }
    toast.success(success);
    refetch();
    return true;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${fullHref}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  return (
    <div className="space-y-5 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={ticket.status as never} />
          <PriorityBadge priority={ticket.priority as never} />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem render={<Link href={fullHref} />}>
              <ExternalLink className="size-4" />
              Open full ticket
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink}>
              <Copy className="size-4" />
              Copy link
            </DropdownMenuItem>
            {canWork && (ticket.status === "OPEN" || ticket.status === "REOPENED") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => patch({ status: "IN_PROGRESS" }, "Marked in progress")}>
                  <PlayCircle className="size-4" />
                  Start working
                </DropdownMenuItem>
              </>
            )}
            {canWork && ticket.status === "IN_PROGRESS" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setResolveOpen(true)}>
                  <CheckCircle2 className="size-4" />
                  Resolve…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg leading-snug font-semibold tracking-tight">{ticket.title}</h2>
        <p className="line-clamp-6 text-sm whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>
        {ticket.attachments.length > 0 && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" />
            {ticket.attachments.length} attachment{ticket.attachments.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button render={<Link href={fullHref} />} className="flex-1">
          <ExternalLink className="size-4" />
          Open full ticket
        </Button>
        {canWork && (ticket.status === "OPEN" || ticket.status === "REOPENED") && (
          <Button
            variant="secondary"
            disabled={working}
            onClick={() => patch({ status: "IN_PROGRESS" }, "Marked in progress")}
          >
            {working ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Start
          </Button>
        )}
        {canWork && ticket.status === "IN_PROGRESS" && (
          <Button variant="secondary" onClick={() => setResolveOpen(true)}>
            <CheckCircle2 className="size-4" />
            Resolve
          </Button>
        )}
      </div>

      <DuplicateBanner ticket={ticket} basePath={basePath} />
      <AiPanel ticket={ticket} compact />

      <DetailsCard ticket={ticket} />

      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <MessageSquare className="size-3.5" />
          Recent activity
        </h3>
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No replies yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar className="mt-0.5 size-6 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs">
                    <span className="font-medium">{c.author.name}</span>
                    <span className="text-muted-foreground"> · {timeAgo(c.createdAt)}</span>
                    {c.isInternal && (
                      <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Internal
                      </span>
                    )}
                  </p>
                  <p className="line-clamp-3 text-sm text-muted-foreground">{c.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve ticket</DialogTitle>
            <DialogDescription>
              Say what fixed it. This note is shown to anyone who later raises a similar ticket.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="What fixed it?"
            aria-label="Resolution note"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={working || !note.trim()}
              onClick={async () => {
                if (await patch({ status: "RESOLVED", resolutionNote: note }, "Ticket resolved")) {
                  setResolveOpen(false);
                  setNote("");
                }
              }}
            >
              {working ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Mark resolved
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
