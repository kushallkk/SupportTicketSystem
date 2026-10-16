"use client";

import { use, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { TicketAttachments } from "@/components/attachments/attachment-list";
import { AgentActions } from "@/components/ticket-detail/agent-actions";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <TicketHeader ticket={ticket} basePath="/agent" />
        <TicketAttachments attachments={ticket.attachments} onChanged={refetch} />
        <DuplicateBanner ticket={ticket} basePath="/agent" />
        <AiPanel ticket={ticket} />
        <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal onPosted={refetch} />
      </div>
      <div className="space-y-4">
        <AgentActions ticket={ticket} onChanged={refetch} />
      </div>
    </div>
  );
}
