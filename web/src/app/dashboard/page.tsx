"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketTable } from "@/components/ticket-table";
import { useTickets } from "@/hooks/use-tickets";
import { Plus } from "lucide-react";

const TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export default function UserDashboardPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState("");

  const filters = useMemo(() => ({ status: status || undefined }), [status]);
  const rooms = useMemo(() => (session?.user?.id ? [`user:${session.user.id}`] : []), [session?.user?.id]);

  const { tickets, loading } = useTickets(filters, rooms);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My tickets</h1>
          <p className="text-sm text-muted-foreground">Track and manage the tickets you&apos;ve raised.</p>
        </div>
        <Button render={<Link href="/dashboard/new" />}>
          <Plus className="size-4" />
          Raise a ticket
        </Button>
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
        basePath="/dashboard"
        showAssignee
        emptyMessage="You haven't raised any tickets yet."
      />
    </div>
  );
}
