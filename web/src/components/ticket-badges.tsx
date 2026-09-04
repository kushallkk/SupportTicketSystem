import { Badge } from "@/components/ui/badge";
import { statusColor, statusLabel, priorityColor, priorityLabel } from "@/lib/ticket-display";
import type { TicketPriority, TicketStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", statusColor[status], className)}>
      {statusLabel[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  return (
    <Badge variant="outline" className={cn("border font-medium", priorityColor[priority], className)}>
      {priorityLabel[priority]}
    </Badge>
  );
}
