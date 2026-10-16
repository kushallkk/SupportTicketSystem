"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TicketWorkspace } from "@/components/ticket-workspace";
import { useTickets } from "@/hooks/use-tickets";

export default function UserDashboardPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filters = useMemo(() => ({ status: status || undefined, q: q || undefined }), [status, q]);
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);

  const { tickets, loading } = useTickets(filters, rooms);

  return (
    <TicketWorkspace
      role="USER"
      title="My tickets"
      subtitle="Track and manage the tickets you've raised."
      basePath="/dashboard"
      rooms={rooms}
      tickets={tickets}
      loading={loading}
      status={status}
      onStatusChange={setStatus}
      query={q}
      onQueryChange={setQ}
      showAssignee
      emptyMessage="You haven't raised any tickets yet."
      headerAction={
        <Button render={<Link href="/dashboard/new" />} className="hidden shadow-md shadow-primary/20 sm:inline-flex">
          <Plus className="size-4" />
          Raise a ticket
        </Button>
      }
    />
  );
}
