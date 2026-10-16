"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { initials, timeAgo } from "@/lib/ticket-display";
import { Loader2, Lock, Send } from "lucide-react";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { FilePicker } from "@/components/attachments/file-picker";
import { uploadAttachments } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import type { TicketDetail } from "@/hooks/use-ticket";

export function CommentThread({
  ticket,
  ticketId,
  canPostInternal,
  onPosted,
}: {
  ticket: TicketDetail;
  ticketId: string;
  canPostInternal: boolean;
  onPosted: () => void;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || loading) return;

    // Clear the composer the moment Post is clicked: anything typed from here on belongs to the
    // next comment and must never be wiped when this one finishes sending. If sending fails the
    // draft is put back below.
    const draft = { body, isInternal, files };
    setBody("");
    setIsInternal(false);
    setFiles([]);
    setLoading(true);

    const res = await fetch(`/api/tickets/${ticketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft.body, isInternal: draft.isInternal }),
    });
    if (!res.ok) {
      setBody((current) => current || draft.body);
      setIsInternal(draft.isInternal);
      setFiles((current) => (current.length > 0 ? current : draft.files));
      setLoading(false);
      toast.error("Couldn't post comment");
      return;
    }
    onPosted();

    if (draft.files.length > 0) {
      const comment = await res.json();
      const uploaded = await uploadAttachments(ticketId, draft.files, comment.id);
      if (!uploaded.ok) toast.warning(`Comment posted, but the attachments weren't saved: ${uploaded.error}`);
      onPosted();
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold tracking-tight">Activity</h3>

      <div className="space-y-4">
        {ticket.comments.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        )}
        {ticket.comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar className="size-7 shrink-0">
              <AvatarFallback className="text-[10px]">{initials(c.author.name)}</AvatarFallback>
            </Avatar>
            <div
              className={cn(
                "min-w-0 flex-1 rounded-2xl px-4 py-2.5",
                c.isInternal ? "bg-amber-500/10 ring-1 ring-amber-500/20" : "bg-muted/50"
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">{c.author.name}</span>
                <span className="text-muted-foreground">{timeAgo(c.createdAt)}</span>
                {c.isInternal && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
                    <Lock className="size-2.5" />
                    Internal
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
              <AttachmentList
                attachments={ticket.attachments.filter((a) => a.commentId === c.id)}
                onChanged={onPosted}
                className="mt-2"
              />
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-2 rounded-2xl bg-card p-3 shadow-[var(--shadow-soft)] ring-1 ring-foreground/5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={canPostInternal ? "Add a comment or internal note..." : "Add a comment..."}
          rows={3}
          className="resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <FilePicker variant="compact" files={files} onChange={setFiles} disabled={loading} />
        <div className="flex items-center justify-between">
          {canPostInternal ? (
            <div className="flex items-center gap-2">
              <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
              <Label htmlFor="internal" className="text-xs text-muted-foreground">
                Internal note (hidden from requester)
              </Label>
            </div>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={loading || !body.trim()}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Post
          </Button>
        </div>
      </form>
    </div>
  );
}
