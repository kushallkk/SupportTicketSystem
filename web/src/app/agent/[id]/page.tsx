"use client";

import { use, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { TicketAttachments } from "@/components/attachments/attachment-list";
import { AgentActions } from "@/components/ticket-detail/agent-actions";
import { TicketNotFound, TicketPageLayout, TicketPageSkeleton } from "@/components/ticket-detail/page-layout";
import { DetailsCard } from "@/components/ticket-preview";

export default function AgentTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = useSession();
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);
  const { ticket, loading, notFound, refetch } = useTicket(id, rooms);

  if (loading) return <TicketPageSkeleton />;
  if (notFound || !ticket) return <TicketNotFound />;

  return (
    <TicketPageLayout
      main={
        <>
          <TicketHeader ticket={ticket} basePath="/agent" />
          <TicketAttachments attachments={ticket.attachments} onChanged={refetch} />
          <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal onPosted={refetch} />
        </>
      }
      aside={
        <>
          <AgentActions ticket={ticket} onChanged={refetch} />
          <DuplicateBanner ticket={ticket} basePath="/agent" />
          <AiPanel ticket={ticket} compact />
          <DetailsCard ticket={ticket} />
        </>
      }
    />
  );
}
