import type { Role } from "@prisma/client";

/** Who may see/interact with a ticket: its requester, the agent it's assigned to, and any admin. */
export function canAccessTicket(
  role: Role,
  userId: string,
  ticket: { raisedById: string; assignedToId: string | null }
): boolean {
  if (role === "ADMIN") return true;
  if (role === "USER") return ticket.raisedById === userId;
  if (role === "AGENT") return ticket.assignedToId === userId;
  return false;
}
