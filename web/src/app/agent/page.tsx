"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketTable } from "@/components/ticket-table";
import { useTickets } from "@/hooks/use-tickets";

const TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default function AgentQueuePage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");

  const filters = useMemo(() => ({ status: status || undefined }), [status]);
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);

  const { tickets, loading } = useTickets(filters, rooms, true);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My queue</h1>
        <p className="text-sm text-muted-foreground">Tickets routed to you, newest first.</p>
      </div>

      <Tabs value={status} onValueChange={setStatus}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <TicketTable
        tickets={tickets}
        loading={loading}
        basePath="/agent"
        showRequester
        emptyMessage="Nothing routed to you right now."
      />
    </div>
  );
}
