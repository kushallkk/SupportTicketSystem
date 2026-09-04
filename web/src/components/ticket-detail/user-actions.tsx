"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TicketDetail } from "@/hooks/use-ticket";

async function patchTicket(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res;
}

export function UserActions({ ticket, onChanged }: { ticket: TicketDetail; onChanged: () => void }) {
  const [score, setScore] = useState(ticket.ratings[0]?.score ?? 0);
  const [feedback, setFeedback] = useState(ticket.ratings[0]?.feedback ?? "");
  const [loading, setLoading] = useState(false);

  const existingRating = ticket.ratings[0];

  async function submitRating() {
    if (score < 1) {
      toast.error("Pick a star rating first");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/tickets/${ticket.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, feedback }),
    });
    if (res.ok && ticket.status === "RESOLVED") {
      await patchTicket(ticket.id, { status: "CLOSED" });
    }
    setLoading(false);
    if (!res.ok) {
      toast.error("Couldn't submit rating");
      return;
    }
    toast.success("Thanks for the feedback");
    onChanged();
  }

  async function reopen() {
    setLoading(true);
    const res = await patchTicket(ticket.id, { status: "REOPENED" });
    setLoading(false);
    if (!res.ok) {
      toast.error("Couldn't reopen ticket");
      return;
    }
    toast.success("Ticket reopened");
    onChanged();
  }

  async function close() {
    setLoading(true);
    const res = await patchTicket(ticket.id, { status: "CLOSED" });
    setLoading(false);
    if (!res.ok) {
      toast.error("Couldn't close ticket");
      return;
    }
    toast.success("Ticket closed");
    onChanged();
  }

  if (ticket.status === "RESOLVED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How did we do?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setScore(n)} aria-label={`${n} stars`}>
                <Star className={cn("size-6", n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
              </button>
            ))}
          </div>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Anything else you want to share? (optional)"
            rows={3}
          />
          <div className="flex gap-2">
            <Button onClick={submitRating} disabled={loading} className="flex-1">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Submit & close ticket
            </Button>
            <Button variant="outline" onClick={reopen} disabled={loading}>
              <RotateCcw className="size-4" />
              Not resolved
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (ticket.status === "CLOSED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {existingRating ? (
            <>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={cn("size-5", n <= existingRating.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground")}
                  />
                ))}
              </div>
              {existingRating.feedback && <p className="text-sm text-muted-foreground">{existingRating.feedback}</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">This ticket is closed.</p>
          )}
          <Button variant="outline" size="sm" onClick={reopen} disabled={loading}>
            <RotateCcw className="size-4" />
            Reopen ticket
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS" || ticket.status === "REOPENED") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            An agent is on it. You&apos;ll get notified the moment there&apos;s an update.
          </p>
          <Button variant="outline" size="sm" onClick={close} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Close ticket
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
