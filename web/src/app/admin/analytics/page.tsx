"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ModelCard } from "@/components/admin/model-card";

type Overview = {
  totalTickets: number;
  ticketsPerDay: { date: string; count: number }[];
  avgResolutionHours: number;
  slaCompliance: number;
  categoryBreakdown: { name: string; count: number }[];
  agentWorkload: { agentId: string; name: string; openCount: number; resolvedCount: number; avgResolutionHours: number }[];
  modelAccuracy: number | null;
  statusCounts: Record<string, number>;
};

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export default function AnalyticsPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/analytics/overview")
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-4 px-4 pt-1 pb-10 sm:px-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
      </div>
    );
  }

  const maxOpen = Math.max(1, ...data.agentWorkload.map((a) => a.openCount));

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-4 pt-1 pb-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">How the desk is performing, and how the AI is doing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Total tickets" value={data.totalTickets.toString()} />
        <StatCard label="Avg resolution time" value={`${data.avgResolutionHours}h`} />
        <StatCard label="SLA compliance" value={`${data.slaCompliance}%`} />
        <StatCard
          label="AI routing accuracy"
          value={data.modelAccuracy != null ? `${data.modelAccuracy}%` : "—"}
          hint="Assignments the admin did not override"
        />
      </div>

      <ModelCard />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tickets per day (last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.ticketsPerDay} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="ticketsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                labelFormatter={(d) => format(new Date(String(d)), "MMM d, yyyy")}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
              />
              <Area type="monotone" dataKey="count" stroke="var(--chart-1)" fill="url(#ticketsGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.categoryBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.categoryBreakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.agentWorkload.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
            {data.agentWorkload.map((a) => (
              <div key={a.agentId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.openCount} open · {a.resolvedCount} resolved · avg {a.avgResolutionHours}h
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(a.openCount / maxOpen) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="transition-shadow hover:shadow-[var(--shadow-lift)]">
      <CardContent className="pt-6">
        <p className="text-gradient w-fit text-3xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {hint && <p className="mt-1 text-[10px] text-muted-foreground/70">{hint}</p>}
      </CardContent>
    </Card>
  );
}
