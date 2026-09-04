import type { TicketPriority, TicketStatus } from "@prisma/client";

export const statusLabel: Record<TicketStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
};

export const statusColor: Record<TicketStatus, string> = {
  OPEN: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  IN_PROGRESS: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
  RESOLVED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  CLOSED: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  REOPENED: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/20",
};

export const priorityLabel: Record<TicketPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export const priorityColor: Record<TicketPriority, string> = {
  LOW: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20",
  MEDIUM: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  HIGH: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
  CRITICAL: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
};

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function timeAgo(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count}${label} ago`;
  }
  return "just now";
}
