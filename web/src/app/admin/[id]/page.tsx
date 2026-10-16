"use client";

import { use } from "react";
import { useTicket } from "@/hooks/use-ticket";
import { TicketHeader } from "@/components/ticket-detail/header";
import { AiPanel, DuplicateBanner } from "@/components/ticket-detail/ai-panel";
import { CommentThread } from "@/components/ticket-detail/comment-thread";
import { TicketAttachments } from "@/components/attachments/attachment-list";
import { AdminActions } from "@/components/ticket-detail/admin-actions";
import { TicketNotFound, TicketPageLayout, TicketPageSkeleton } from "@/components/ticket-detail/page-layout";
import { DetailsCard } from "@/components/ticket-preview";

const ROOMS = ["role:ADMIN"];

export default function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ticket, loading, notFound, refetch } = useTicket(id, ROOMS);

  if (loading) return <TicketPageSkeleton />;
  if (notFound || !ticket) return <TicketNotFound />;

  return (
    <TicketPageLayout
      main={
        <>
          <TicketHeader ticket={ticket} basePath="/admin" />
          <TicketAttachments attachments={ticket.attachments} onChanged={refetch} />
          <CommentThread ticket={ticket} ticketId={ticket.id} canPostInternal onPosted={refetch} />
        </>
      }
      aside={
        <>
          <AdminActions ticket={ticket} onChanged={refetch} />
          <DuplicateBanner ticket={ticket} basePath="/admin" />
          <AiPanel ticket={ticket} compact />
          <DetailsCard ticket={ticket} />
        </>
      }
    />
  );
}
