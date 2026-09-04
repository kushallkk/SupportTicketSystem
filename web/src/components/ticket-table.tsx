"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { StatusBadge, PriorityBadge } from "@/components/ticket-badges";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { initials, timeAgo } from "@/lib/ticket-display";
import { MessageSquare, GitMerge, Inbox } from "lucide-react";
import type { TicketListItem } from "@/hooks/use-tickets";

export function TicketTable({
  tickets,
  loading,
  basePath,
  showRequester = false,
  showAssignee = false,
  emptyMessage = "No tickets here yet.",
}: {
  tickets: TicketListItem[];
  loading: boolean;
  basePath: string;
  showRequester?: boolean;
  showAssignee?: boolean;
  emptyMessage?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
        <Inbox className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="divide-y">
        {tickets.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.02 }}
          >
          <Link
            href={`${basePath}/${t.id}`}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{t.title}</p>
                {t.duplicateOfId && (
                  <span title="Flagged as a possible duplicate">
                    <GitMerge className="size-3.5 shrink-0 text-purple-500" />
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{t.category?.name ?? "Uncategorized"}</span>
                <span>·</span>
                <span>{timeAgo(t.createdAt)}</span>
                {t._count.comments > 0 && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {t._count.comments}
                    </span>
                  </>
                )}
                {showRequester && (
                  <>
                    <span>·</span>
                    <span>{t.raisedBy.name}</span>
                  </>
                )}
              </div>
            </div>

            <PriorityBadge priority={t.priority as never} className="shrink-0" />
            <StatusBadge status={t.status as never} className="shrink-0" />

            {showAssignee && (
              <Avatar className="size-6 shrink-0" title={t.assignedTo?.name ?? "Unassigned"}>
                <AvatarFallback className="text-[10px]">
                  {t.assignedTo ? initials(t.assignedTo.name) : "—"}
                </AvatarFallback>
              </Avatar>
            )}
          </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
