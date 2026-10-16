import { Badge } from "@/components/ui/badge";
import { statusColor, statusDot, statusLabel, priorityColor, priorityDot, priorityLabel } from "@/lib/ticket-display";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

function Dot({ className }: { className: string }) {
  return <span aria-hidden className={cn("size-1.5 rounded-full", className)} />;
}

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", statusColor[status], className)}>
      <Dot className={statusDot[status]} />
      {statusLabel[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 border-transparent font-medium", priorityColor[priority], className)}>
      <Dot className={priorityDot[priority]} />
      {priorityLabel[priority]}
    </Badge>
  );
}
