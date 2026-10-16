"use client";

import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/use-socket";

export type AttachmentInfo = {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  commentId: string | null;
  isInternal: boolean;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

export type TicketDetail = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  resolutionNote: string | null;
  aiCategory: string | null;
  aiPriority: string | null;
  aiConfidence: number | null;
  duplicateOfId: string | null;
  similarityScore: number | null;
  category: { id: string; name: string } | null;
  raisedBy: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  duplicateOf: { id: string; title: string; resolutionNote: string | null; status: string } | null;
  comments: {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: { id: string; name: string; role: string };
  }[];
  ratings: { id: string; score: number; feedback: string | null }[];
  attachments: AttachmentInfo[];
  assignmentLogs: { wasOverridden: boolean; aiSuggestedScore: number | null }[];
};

export function useTicket(id: string, realtimeRooms: string[] = []) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/tickets/${id}`);
    if (res.status === 404 || res.status === 403) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (res.ok) setTicket(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useRealtime(realtimeRooms, {
    "ticket:updated": (payload) => {
      if ((payload as { ticketId: string }).ticketId === id) refetch();
    },
    "ticket:comment": (payload) => {
      if ((payload as { ticketId: string }).ticketId === id) refetch();
    },
  });

  return { ticket, loading, notFound, refetch };
}
