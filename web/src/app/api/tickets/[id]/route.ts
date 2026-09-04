import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { emitTicketEvent, emitToAdmins } from "@/lib/socket-server";
import type { TicketPriority, TicketStatus } from "@prisma/client";

async function loadTicket(id: string) {
  return prisma.ticket.findUnique({
    where: { id },
    include: {
      category: true,
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      duplicateOf: { select: { id: true, title: true, resolutionNote: true, status: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      ratings: true,
      assignmentLogs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const ticket = await loadTicket(id);
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "USER" && ticket.raisedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "AGENT" && ticket.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Hide internal notes from the raising user.
  const visibleComments =
    user.role === "USER" ? ticket.comments.filter((c) => !c.isInternal) : ticket.comments;

  return NextResponse.json({ ...ticket, comments: visibleComments });
}

const AGENT_ALLOWED_STATUS: TicketStatus[] = ["IN_PROGRESS", "RESOLVED"];
const USER_ALLOWED_STATUS: TicketStatus[] = ["CLOSED", "REOPENED"];

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const existing = await prisma.ticket.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const data: {
    status?: TicketStatus;
    priority?: TicketPriority;
    categoryId?: string;
    assignedToId?: string | null;
    resolutionNote?: string;
    resolvedAt?: Date;
    closedAt?: Date;
  } = {};

  if (user.role === "USER") {
    if (existing.raisedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.status && !USER_ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Users may only close or reopen tickets" }, { status: 403 });
    }
    if (body.status === "CLOSED") data.closedAt = new Date();
    if (body.status) data.status = body.status;
  }

  if (user.role === "AGENT") {
    if (existing.assignedToId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (body.status && !AGENT_ALLOWED_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status transition for agents" }, { status: 403 });
    }
    if (body.status) data.status = body.status;
    if (body.resolutionNote !== undefined) data.resolutionNote = body.resolutionNote;
    if (body.status === "RESOLVED") data.resolvedAt = new Date();
  }

  if (user.role === "ADMIN") {
    if (body.status) data.status = body.status;
    if (body.priority) data.priority = body.priority;
    if (body.categoryId) data.categoryId = body.categoryId;
    if (body.resolutionNote !== undefined) data.resolutionNote = body.resolutionNote;
    if (body.status === "RESOLVED") data.resolvedAt = new Date();
    if (body.status === "CLOSED") data.closedAt = new Date();

    if (body.assignedToId !== undefined && body.assignedToId !== existing.assignedToId) {
      data.assignedToId = body.assignedToId;
      await prisma.assignmentLog.create({
        data: {
          ticketId: id,
          aiSuggestedAgentId: existing.aiSuggestedAgentId,
          finalAgentId: body.assignedToId,
          wasOverridden: existing.aiSuggestedAgentId !== null && existing.aiSuggestedAgentId !== body.assignedToId,
          overriddenById: user.id,
          reason: body.overrideReason ?? null,
        },
      });
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data,
    include: {
      category: true,
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  // Roll up resolution stats for the load-balancer once a ticket is resolved.
  if (data.status === "RESOLVED" && ticket.assignedToId && ticket.categoryId && existing.createdAt) {
    const minutes = (Date.now() - existing.createdAt.getTime()) / 60000;
    const agentProfile = await prisma.agentProfile.findUnique({ where: { userId: ticket.assignedToId } });
    if (agentProfile) {
      const stat = await prisma.agentCategoryStat.findUnique({
        where: { agentProfileId_categoryId: { agentProfileId: agentProfile.id, categoryId: ticket.categoryId } },
      });
      const prevCount = stat?.resolvedCount ?? 0;
      const prevAvg = stat?.avgResolutionMins ?? minutes;
      const newAvg = (prevAvg * prevCount + minutes) / (prevCount + 1);
      await prisma.agentCategoryStat.upsert({
        where: { agentProfileId_categoryId: { agentProfileId: agentProfile.id, categoryId: ticket.categoryId } },
        update: { resolvedCount: prevCount + 1, avgResolutionMins: newAvg },
        create: { agentProfileId: agentProfile.id, categoryId: ticket.categoryId, resolvedCount: 1, avgResolutionMins: minutes },
      });
    }
  }

  emitTicketEvent("ticket:updated", { ticketId: ticket.id, raisedById: ticket.raisedById, assignedToId: ticket.assignedToId });
  emitToAdmins("ticket:updated", { ticketId: ticket.id });

  return NextResponse.json(ticket);
}
