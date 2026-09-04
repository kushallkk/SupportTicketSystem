"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PlayCircle, CheckCircle2 } from "lucide-react";
import type { TicketDetail } from "@/hooks/use-ticket";

export function AgentActions({ ticket, onChanged }: { ticket: TicketDetail; onChanged: () => void }) {
  const [resolutionNote, setResolutionNote] = useState(ticket.resolutionNote ?? "");
  const [loading, setLoading] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Couldn't update ticket");
      return;
    }
    onChanged();
  }

  if (ticket.status === "OPEN" || ticket.status === "REOPENED") {
    return (
      <Card>
        <CardContent className="pt-6">
          <Button onClick={() => patch({ status: "IN_PROGRESS" })} disabled={loading} className="w-full">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
            Start working on this
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (ticket.status === "IN_PROGRESS") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resolve ticket</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="resolutionNote">Resolution note</Label>
            <Textarea
              id="resolutionNote"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="What fixed it? This gets shown if someone hits a duplicate later."
              rows={4}
            />
          </div>
          <Button
            onClick={() => patch({ status: "RESOLVED", resolutionNote })}
            disabled={loading || !resolutionNote.trim()}
            className="w-full"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Mark resolved
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (ticket.status === "RESOLVED" || ticket.status === "CLOSED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resolution</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
            {ticket.resolutionNote || "No resolution note was added."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return null;
}
