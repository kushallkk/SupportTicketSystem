"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { GitMerge, Inbox, MessageSquare, MousePointerClick, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriorityBadge, StatusBadge } from "@/components/ticket-badges";
import { TicketPreview } from "@/components/ticket-preview";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { TicketListItem } from "@/hooks/use-tickets";
import { initials, timeAgo } from "@/lib/ticket-display";
import { cn } from "@/lib/utils";

export type Role = "USER" | "AGENT" | "ADMIN";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

const PRIORITY_BAR: Record<string, string> = {
  LOW: "bg-slate-300 dark:bg-slate-600",
  MEDIUM: "bg-blue-400",
  HIGH: "bg-orange-400",
  CRITICAL: "bg-red-500",
};

/**
 * The 3-column ticket viewport: the app sidebar (rendered by AppShell) | this centre feed |
 * a right-hand panel showing the selected ticket in context. Below the `xl` breakpoint there is no
 * room for the panel, so rows simply open the full ticket page instead.
 */
export function TicketWorkspace({
  role,
  title,
  subtitle,
  basePath,
  rooms,
  tickets,
  loading,
  status,
  onStatusChange,
  query,
  onQueryChange,
  headerAction,
  showRequester = false,
  showAssignee = false,
  emptyMessage = "No tickets here yet.",
}: {
  role: Role;
  title: string;
  subtitle: string;
  basePath: string;
  rooms: string[];
  tickets: TicketListItem[];
  loading: boolean;
  status: string;
  onStatusChange: (status: string) => void;
  query?: string;
  onQueryChange?: (q: string) => void;
  headerAction?: React.ReactNode;
  showRequester?: boolean;
  showAssignee?: boolean;
  emptyMessage?: string;
}) {
  const hasPanel = useMediaQuery("(min-width: 1280px)");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = tickets.find((t) => t.id === selectedId) ?? tickets[0] ?? null;

  return (
    <div className="flex h-full min-h-0">
      {/* Centre: the feed */}
      <section className="flex min-w-0 flex-1 flex-col" aria-label="Tickets">
        <div className="space-y-4 px-4 pt-1 pb-3 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {headerAction}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={status} onValueChange={onStatusChange}>
              <TabsList className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {STATUS_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="px-3">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            {onQueryChange && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query ?? ""}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Search tickets..."
                  className="h-9 rounded-lg border-transparent bg-muted/60 pl-8 shadow-none focus-visible:bg-background"
                />
              </div>
            )}
          </div>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 pb-6 sm:px-4">
          <Feed
            tickets={tickets}
            loading={loading}
            basePath={basePath}
            emptyMessage={emptyMessage}
            showRequester={showRequester}
            showAssignee={showAssignee}
            selectedId={hasPanel ? selected?.id ?? null : null}
            onSelect={(id) => (hasPanel ? setSelectedId(id) : undefined)}
            interceptClicks={hasPanel}
          />
        </div>
      </section>

      {/* Right: contextual detail panel */}
      {hasPanel && (
        <aside
          aria-label="Ticket details"
          className="scrollbar-thin my-0 mr-2 mb-2 w-[25rem] shrink-0 overflow-y-auto rounded-2xl bg-muted/40 2xl:w-[28rem]"
        >
          {selected ? (
            <TicketPreview key={selected.id} ticketId={selected.id} role={role} basePath={basePath} rooms={rooms} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-background shadow-[var(--shadow-soft)]">
                <MousePointerClick className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No ticket selected</p>
                <p className="text-xs text-muted-foreground">Pick a ticket from the feed to see it here.</p>
              </div>
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function Feed({
  tickets,
  loading,
  basePath,
  emptyMessage,
  showRequester,
  showAssignee,
  selectedId,
  onSelect,
  interceptClicks,
}: {
  tickets: TicketListItem[];
  loading: boolean;
  basePath: string;
  emptyMessage: string;
  showRequester: boolean;
  showAssignee: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  interceptClicks: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 px-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="mx-2 flex flex-col items-center justify-center gap-3 rounded-2xl bg-muted/40 py-20 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-background shadow-[var(--shadow-soft)]">
          <Inbox className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-1">
      {tickets.map((t, i) => {
        const active = t.id === selectedId;
        return (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.02 }}
          >
            <Link
              href={`${basePath}/${t.id}`}
              aria-current={active ? "true" : undefined}
              onClick={(e) => {
                const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
                if (interceptClicks && plain) {
                  e.preventDefault();
                  onSelect(t.id);
                }
              }}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-3 outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "bg-card shadow-[var(--shadow-soft)] ring-1 ring-foreground/5"
                  : "hover:bg-muted/60"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-3 bottom-3 left-0 w-0.5 rounded-full transition-opacity",
                  PRIORITY_BAR[t.priority] ?? "bg-slate-300",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}
              />
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                  {initials(t.raisedBy.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  {t.duplicateOfId && (
                    <span title="Flagged as a possible duplicate">
                      <GitMerge className="size-3.5 shrink-0 text-purple-500" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.description}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground/80">
                  <span>{t.category?.name ?? "Uncategorized"}</span>
                  <span aria-hidden>·</span>
                  <span>{timeAgo(t.createdAt)}</span>
                  {showRequester && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t.raisedBy.name}</span>
                    </>
                  )}
                  {t._count.comments > 0 && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="size-3" />
                        {t._count.comments}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <StatusBadge status={t.status as never} />
                <PriorityBadge priority={t.priority as never} />
              </div>

              {showAssignee && (
                <Avatar className="size-6 shrink-0" title={t.assignedTo?.name ?? "Unassigned"}>
                  <AvatarFallback className="text-[10px]">
                    {t.assignedTo ? initials(t.assignedTo.name) : "—"}
                  </AvatarFallback>
                </Avatar>
              )}
            </Link>
          </motion.li>
        );
      })}
    </ul>
  );
}
