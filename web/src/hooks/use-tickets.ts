"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/use-socket";
import { toast } from "sonner";

export type TicketListItem = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  aiConfidence: number | null;
  duplicateOfId: string | null;
  similarityScore: number | null;
  category: { id: string; name: string } | null;
  raisedBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  _count: { comments: number };
};

export function useTickets(
  filters: { status?: string; priority?: string; categoryId?: string; q?: string } = {},
  realtimeRooms: string[] = [],
  notifyOnCreate = false
) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.priority) params.set("priority", filters.priority);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.q) params.set("q", filters.q);

    const res = await fetch(`/api/tickets?${params.toString()}`);
    if (res.ok) setTickets(await res.json());
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.priority, filters.categoryId, filters.q]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtime(realtimeRooms, {
    "ticket:created": () => {
      if (notifyOnCreate) toast.info("A new ticket just came in");
      refetch();
    },
    "ticket:updated": () => refetch(),
    "ticket:comment": () => refetch(),
  });

  return { tickets, loading, refetch };
}
