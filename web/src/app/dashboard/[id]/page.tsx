"use client";

import { use, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { UserActions } from "@/components/ticket-detail/user-actions";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function UserTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);
  const { ticket, loading, notFound, refetch } = useTicket(id, rooms);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (notFound || !ticket) {
    return <p className="text-sm text-muted-foreground">Ticket not found.</p>;
  }

  async function selfResolve() {
    if (!ticket?.duplicateOf) return;
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CLOSED", resolutionNote: ticket.duplicateOf.resolutionNote ?? undefined }),
    });
    if (!res.ok) {
      toast.error("Couldn't self-resolve");
      return;
    }
    toast.success("Ticket resolved");
    refetch();
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <TicketHeader ticket={ticket} basePath="/dashboard" />
        <DuplicateBanner
          ticket={ticket}
          basePath="/dashboard"
          showSelfResolve={ticket.status === "OPEN"}
          onSelfResolve={selfResolve}
        />
        <AiPanel ticket={ticket} />
        <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal={false} onPosted={refetch} />
      </div>
      <div className="space-y-4">
        <UserActions ticket={ticket} onChanged={refetch} />
      </div>
    </div>
  );
}
