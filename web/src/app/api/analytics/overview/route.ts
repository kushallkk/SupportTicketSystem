import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";

const SLA_HOURS: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 72,
  LOW: 168,
};

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("error" in auth) return auth.error;

  // Day buckets are UTC calendar days end to end. (Mixing local-midnight starts with UTC date
  // keys shifted the chart by a day outside UTC and dropped today's tickets.)
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 13);
  since.setUTCHours(0, 0, 0, 0);

  const [tickets, categories, agents, assignmentLogs] = await Promise.all([
    prisma.ticket.findMany({
      select: {
        id: true,
        status: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        categoryId: true,
        category: { select: { name: true } },
        assignedToId: true,
      },
    }),
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "AGENT" },
      select: {
        id: true,
        name: true,
        ticketsAssigned: { select: { id: true, status: true, createdAt: true, resolvedAt: true } },
      },
    }),
    prisma.assignmentLog.findMany({ select: { wasOverridden: true, aiSuggestedAgentId: true } }),
  ]);

  // Tickets per day, last 14 days
  const dayBuckets: Record<string, number> = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setUTCDate(d.getUTCDate() + i);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const t of tickets) {
    const key = t.createdAt.toISOString().slice(0, 10);
    if (key in dayBuckets) dayBuckets[key]++;
  }
  const ticketsPerDay = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));

  // Resolution time + SLA compliance
  const resolved = tickets.filter((t) => t.resolvedAt);
  const resolutionHours = resolved.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000);
  const avgResolutionHours = resolutionHours.length
    ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
    : 0;

  const slaMet = resolved.filter((t) => {
    const hours = (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000;
    return hours <= (SLA_HOURS[t.priority] ?? 72);
  }).length;
  const slaCompliance = resolved.length ? (slaMet / resolved.length) * 100 : 100;

  // Category breakdown
  const categoryCounts = new Map<string, number>();
  for (const t of tickets) {
    const name = t.category?.name ?? "Uncategorized";
    categoryCounts.set(name, (categoryCounts.get(name) ?? 0) + 1);
  }
  const categoryBreakdown = Array.from(categoryCounts, ([name, count]) => ({ name, count })).sort(
    (a, b) => b.count - a.count
  );

  // Agent workload heatmap
  const agentWorkload = agents.map((a) => {
    const open = a.ticketsAssigned.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
    const resolvedTickets = a.ticketsAssigned.filter((t) => t.resolvedAt);
    const avgHours = resolvedTickets.length
      ? resolvedTickets.reduce((sum, t) => sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000, 0) /
        resolvedTickets.length
      : 0;
    return {
      agentId: a.id,
      name: a.name,
      openCount: open,
      resolvedCount: resolvedTickets.length,
      avgResolutionHours: Math.round(avgHours * 10) / 10,
    };
  });

  // Model accuracy — % of AI-suggested assignments the admin did NOT override.
  const aiSuggested = assignmentLogs.filter((l) => l.aiSuggestedAgentId);
  const modelAccuracy = aiSuggested.length
    ? (aiSuggested.filter((l) => !l.wasOverridden).length / aiSuggested.length) * 100
    : null;

  const statusCounts = {
    OPEN: tickets.filter((t) => t.status === "OPEN").length,
    IN_PROGRESS: tickets.filter((t) => t.status === "IN_PROGRESS").length,
    RESOLVED: tickets.filter((t) => t.status === "RESOLVED").length,
    CLOSED: tickets.filter((t) => t.status === "CLOSED").length,
    REOPENED: tickets.filter((t) => t.status === "REOPENED").length,
  };

  return NextResponse.json({
    totalTickets: tickets.length,
    ticketsPerDay,
    avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
    slaCompliance: Math.round(slaCompliance * 10) / 10,
    categoryBreakdown,
    agentWorkload,
    modelAccuracy: modelAccuracy === null ? null : Math.round(modelAccuracy * 10) / 10,
    statusCounts,
    categoriesCount: categories.length,
  });
}
