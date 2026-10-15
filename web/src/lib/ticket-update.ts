import { z } from "zod";
import type { Role, TicketPriority, TicketStatus } from "@prisma/client";

export const AGENT_ALLOWED_STATUS: TicketStatus[] = ["IN_PROGRESS", "RESOLVED"];
export const USER_ALLOWED_STATUS: TicketStatus[] = ["CLOSED", "REOPENED"];

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "REOPENED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export const ticketPatchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  categoryId: z.string().min(1).optional(),
  assignedToId: z.string().min(1).nullable().optional(),
  resolutionNote: z.string().max(5000).optional(),
  overrideReason: z.string().max(500).optional(),
});

export type TicketUpdateData = {
  status?: TicketStatus;
  priority?: TicketPriority;
  categoryId?: string;
  assignedToId?: string | null;
  resolutionNote?: string;
  resolvedAt?: Date;
  closedAt?: Date;
};

export type Reassignment = {
  finalAgentId: string | null;
  wasOverridden: boolean;
  reason: string | null;
};

export type TicketUpdateResult =
  | { ok: false; status: 400 | 403; error: string }
  | { ok: true; data: TicketUpdateData; reassignment: Reassignment | null };

type ExistingTicket = {
  raisedById: string;
  assignedToId: string | null;
  aiSuggestedAgentId: string | null;
};

/**
 * Decides what a given role may change on a ticket. Pure (no DB, no clock
 * unless `now` is omitted) so the permission rules can be unit tested.
 */
export function buildTicketUpdate(input: {
  role: Role;
  userId: string;
  ticket: ExistingTicket;
  body: unknown;
  now?: Date;
}): TicketUpdateResult {
  const { role, userId, ticket } = input;
  const now = input.now ?? new Date();

  const parsed = ticketPatchSchema.safeParse(input.body);
  if (!parsed.success) {
    return { ok: false, status: 400, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const body = parsed.data;
  const data: TicketUpdateData = {};
  let reassignment: Reassignment | null = null;

  if (role === "USER") {
    if (ticket.raisedById !== userId) return { ok: false, status: 403, error: "Forbidden" };
    if (body.status && !USER_ALLOWED_STATUS.includes(body.status)) {
      return { ok: false, status: 403, error: "Users may only close or reopen tickets" };
    }
    if (body.status === "CLOSED") data.closedAt = now;
    if (body.status) data.status = body.status;
  }

  if (role === "AGENT") {
    if (ticket.assignedToId !== userId) return { ok: false, status: 403, error: "Forbidden" };
    if (body.status && !AGENT_ALLOWED_STATUS.includes(body.status)) {
      return { ok: false, status: 403, error: "Invalid status transition for agents" };
    }
    if (body.status) data.status = body.status;
    if (body.resolutionNote !== undefined) data.resolutionNote = body.resolutionNote;
    if (body.status === "RESOLVED") data.resolvedAt = now;
  }

  if (role === "ADMIN") {
    if (body.status) data.status = body.status;
    if (body.priority) data.priority = body.priority;
    if (body.categoryId) data.categoryId = body.categoryId;
    if (body.resolutionNote !== undefined) data.resolutionNote = body.resolutionNote;
    if (body.status === "RESOLVED") data.resolvedAt = now;
    if (body.status === "CLOSED") data.closedAt = now;

    if (body.assignedToId !== undefined && body.assignedToId !== ticket.assignedToId) {
      data.assignedToId = body.assignedToId;
      reassignment = {
        finalAgentId: body.assignedToId,
        wasOverridden: ticket.aiSuggestedAgentId !== null && ticket.aiSuggestedAgentId !== body.assignedToId,
        reason: body.overrideReason ?? null,
      };
    }
  }

  return { ok: true, data, reassignment };
}
