"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { TicketWorkspace } from "@/components/ticket-workspace";
import { useTickets } from "@/hooks/use-tickets";

export default function AgentQueuePage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filters = useMemo(() => ({ status: status || undefined, q: q || undefined }), [status, q]);
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);

  const { tickets, loading } = useTickets(filters, rooms, true);

  return (
    <TicketWorkspace
      role="AGENT"
      title="My queue"
      subtitle="Tickets routed to you, newest first."
      basePath="/agent"
      rooms={rooms}
      tickets={tickets}
      loading={loading}
      status={status}
      onStatusChange={setStatus}
      query={q}
      onQueryChange={setQ}
      showRequester
      emptyMessage="Nothing routed to you right now."
    />
  );
}
