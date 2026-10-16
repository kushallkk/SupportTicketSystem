"use client";

import { useMemo, useState } from "react";
import { TicketWorkspace } from "@/components/ticket-workspace";
import { useTickets } from "@/hooks/use-tickets";

const ROOMS = ["role:ADMIN"];

export default function AdminTicketsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filters = useMemo(() => ({ status: status || undefined, q: q || undefined }), [status, q]);
  const { tickets, loading } = useTickets(filters, ROOMS, true);

  return (
    <TicketWorkspace
      role="ADMIN"
      title="All tickets"
      subtitle="Every ticket in the system, with manual override controls."
      basePath="/admin"
      rooms={ROOMS}
      tickets={tickets}
      loading={loading}
      status={status}
      onStatusChange={setStatus}
      query={q}
      onQueryChange={setQ}
      showRequester
      showAssignee
    />
  );
}
