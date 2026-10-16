"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/ticket-display";

type AgentRow = {
  id: string;
  name: string;
  email: string;
  openCount: number;
  resolvedCount: number;
  totalCount: number;
  categoryStats: { category: { name: string }; resolvedCount: number; avgResolutionMins: number; accuracyScore: number }[];
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then(setAgents);
  }, []);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-4 pt-1 pb-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground">Workload and category track record used by the routing model.</p>
      </div>

      {!agents && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {agents?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No agents yet — agents sign up from the signup page and choose &quot;Support agent&quot;.
        </p>
      )}

      <div className="space-y-3">
        {agents?.map((a) => (
          <Card key={a.id}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Avatar className="size-9">
                <AvatarFallback>{initials(a.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <CardTitle className="text-base">{a.name}</CardTitle>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
              </div>
              <div className="flex gap-4 text-center text-sm">
                <div>
                  <p className="font-semibold">{a.openCount}</p>
                  <p className="text-xs text-muted-foreground">Open</p>
                </div>
                <div>
                  <p className="font-semibold">{a.resolvedCount}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardHeader>
            {a.categoryStats.length > 0 && (
              <CardContent className="flex flex-wrap gap-2 pt-0">
                {a.categoryStats.map((s, i) => (
                  <Badge key={i} variant="secondary" className="font-normal">
                    {s.category.name}: {s.resolvedCount} resolved · avg {Math.round(s.avgResolutionMins)}m
                  </Badge>
                ))}
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      </div>
    </div>
  );
}
