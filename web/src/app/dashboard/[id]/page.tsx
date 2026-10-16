"use client";

import { use, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { TicketAttachments } from "@/components/attachments/attachment-list";
import { UserActions } from "@/components/ticket-detail/user-actions";
import { TicketNotFound, TicketPageLayout, TicketPageSkeleton } from "@/components/ticket-detail/page-layout";
import { DetailsCard } from "@/components/ticket-preview";
import { toast } from "sonner";

export default function UserTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);
  const { ticket, loading, notFound, refetch } = useTicket(id, rooms);

  if (loading) return <TicketPageSkeleton />;
  if (notFound || !ticket) return <TicketNotFound />;

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
    <TicketPageLayout
      main={
        <>
          <TicketHeader ticket={ticket} basePath="/dashboard" />
          <TicketAttachments attachments={ticket.attachments} onChanged={refetch} />
          <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal={false} onPosted={refetch} />
        </>
      }
      aside={
        <>
          <UserActions ticket={ticket} onChanged={refetch} />
          <DuplicateBanner
            ticket={ticket}
            basePath="/dashboard"
            showSelfResolve={ticket.status === "OPEN"}
            onSelfResolve={selfResolve}
          />
          <AiPanel ticket={ticket} compact />
          <DetailsCard ticket={ticket} />
        </>
      }
    />
  );
}
