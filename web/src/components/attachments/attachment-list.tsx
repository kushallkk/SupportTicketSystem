"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Download, FileText, Loader2, Lock, Trash2 } from "lucide-react";
import { formatBytes, isInlineImage } from "@/lib/attachment-rules";
import { deleteAttachment } from "@/lib/upload-client";
import type { AttachmentInfo } from "@/hooks/use-ticket";

/** Files for one place on a ticket (the ticket itself, or a single comment). Renders nothing if empty. */
export function AttachmentList({
  attachments,
  onChanged,
  className,
}: {
  attachments: AttachmentInfo[];
  onChanged: () => void;
  className?: string;
}) {
  const { data: session } = useSession();
  const [removing, setRemoving] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  async function remove(a: AttachmentInfo) {
    if (!window.confirm(`Remove "${a.fileName}"? This can't be undone.`)) return;
    setRemoving(a.id);
    const result = await deleteAttachment(a.id);
    setRemoving(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("File removed");
    onChanged();
  }

  const images = attachments.filter((a) => isInlineImage(a.mimeType));
  const others = attachments.filter((a) => !isInlineImage(a.mimeType));
  const canRemove = (a: AttachmentInfo) => session?.user?.role === "ADMIN" || session?.user?.id === a.uploadedBy.id;

  const removeButton = (a: AttachmentInfo) =>
    canRemove(a) && (
      <button
        type="button"
        aria-label={`Remove ${a.fileName}`}
        disabled={removing === a.id}
        onClick={() => remove(a)}
        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        {removing === a.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    );

  return (
    <div className={className} data-testid="attachment-list">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <figure key={a.id} className="group relative w-32 overflow-hidden rounded-lg border bg-muted/30">
              <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer" title={`Open ${a.fileName}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- authorized API route, not a static asset */}
                <img src={`/api/attachments/${a.id}`} alt={a.fileName} className="h-24 w-full object-cover" loading="lazy" />
              </a>
              <figcaption className="flex items-center gap-1 px-2 py-1 text-[11px]">
                {a.isInternal && <Lock className="size-3 shrink-0 text-amber-500" aria-label="Internal" />}
                <span className="min-w-0 flex-1 truncate" title={a.fileName}>{a.fileName}</span>
                {removeButton(a)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <ul className={images.length > 0 ? "mt-2 space-y-1.5" : "space-y-1.5"}>
          {others.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-sm">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              {a.isInternal && <Lock className="size-3 shrink-0 text-amber-500" aria-label="Internal" />}
              <span className="min-w-0 flex-1 truncate" title={a.fileName}>{a.fileName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(a.fileSize)}</span>
              <a
                href={`/api/attachments/${a.id}`}
                download={a.fileName}
                aria-label={`Download ${a.fileName}`}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Download className="size-3.5" />
              </a>
              {removeButton(a)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Ticket-level files (not tied to a comment), shown under the description. */
export function TicketAttachments({ attachments, onChanged }: { attachments: AttachmentInfo[]; onChanged: () => void }) {
  const own = attachments.filter((a) => a.commentId === null);
  if (own.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">Attachments</h3>
      <AttachmentList attachments={own} onChanged={onChanged} />
    </section>
  );
}
