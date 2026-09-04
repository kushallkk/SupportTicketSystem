"use client";

import { use } from "react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { AdminActions } from "@/components/ticket-detail/admin-actions";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ticket, loading, notFound, refetch } = useTicket(id, ["role:ADMIN"]);

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
        <TicketHeader ticket={ticket} basePath="/admin" />
        <DuplicateBanner ticket={ticket} basePath="/admin" />
        <AiPanel ticket={ticket} />
        <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal onPosted={refetch} />
      </div>
      <div className="space-y-4">
        <AdminActions ticket={ticket} onChanged={refetch} />
      </div>
    </div>
  );
}
