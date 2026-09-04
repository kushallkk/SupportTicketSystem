"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { TicketTable } from "@/components/ticket-table";
import { useTickets } from "@/hooks/use-tickets";
import { Search } from "lucide-react";

const TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default function AdminTicketsPage() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const filters = useMemo(() => ({ status: status || undefined, q: q || undefined }), [status, q]);
  const { tickets, loading } = useTickets(filters, ["role:ADMIN"], true);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">All tickets</h1>
        <p className="text-sm text-muted-foreground">Every ticket in the system, with manual override controls.</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets..." className="pl-8" />
        </div>
      </div>

      <TicketTable tickets={tickets} loading={loading} basePath="/admin" showRequester showAssignee />
    </div>
  );
}
