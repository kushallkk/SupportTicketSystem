"use client";

import { toast } from "sonner";
import { formatTicketId } from "@/lib/ticket-display";
import { cn } from "@/lib/utils";

/** The ticket's human-friendly ID (TKT-0042). With `copyable`, clicking it copies the ID. */
export function TicketId({ number, copyable = false, className }: { number: number; copyable?: boolean; className?: string }) {
  const id = formatTicketId(number);
  const base = "shrink-0 font-mono text-xs font-medium tracking-tight text-muted-foreground tabular-nums";

  if (!copyable) {
    return (
      <span data-testid="ticket-id" className={cn(base, className)}>
        {id}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-testid="ticket-id"
      title="Copy ticket ID"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(id);
          toast.success(`${id} copied`);
        } catch {
          toast.error("Couldn't copy the ID");
        }
      }}
      className={cn(base, "rounded-md bg-muted px-1.5 py-0.5 transition-colors hover:bg-muted/70 hover:text-foreground", className)}
    >
      {id}
    </button>
  );
}
