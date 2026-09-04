"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import type { TicketDetail } from "@/hooks/use-ticket";

type Agent = { id: string; name: string; email: string; openCount: number };
type Category = { id: string; name: string };

export function AdminActions({ ticket, onChanged }: { ticket: TicketDetail; onChanged: () => void }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignedToId, setAssignedToId] = useState(ticket.assignedTo?.id ?? "");
  const [categoryId, setCategoryId] = useState(ticket.category?.id ?? "");
  const [priority, setPriority] = useState(ticket.priority);
  const [status, setStatus] = useState(ticket.status);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setAgents);
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  const lastLog = ticket.assignmentLogs[0];

  async function save() {
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assignedToId: assignedToId || null,
        categoryId: categoryId || undefined,
        priority,
        status,
        overrideReason: reason || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Couldn't update ticket");
      return;
    }
    toast.success("Ticket updated");
    setReason("");
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Admin controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {lastLog && (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <ShieldAlert className="size-3.5 shrink-0" />
            {lastLog.wasOverridden
              ? "This assignment was manually overridden."
              : "This ticket is on the agent the model suggested."}
            {lastLog.aiSuggestedScore != null && ` (routing score ${lastLog.aiSuggestedScore.toFixed(2)})`}
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Assigned agent</Label>
          <Select value={assignedToId} onValueChange={(v) => setAssignedToId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.openCount} open
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Uncategorized" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Low</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="CLOSED">Closed</SelectItem>
              <SelectItem value="REOPENED">Reopened</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Override reason (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why change this?" />
        </div>

        <Button onClick={save} disabled={loading} className="w-full">
          {loading && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </CardContent>
    </Card>
  );
}
