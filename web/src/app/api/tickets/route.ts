import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { ticketCreateSchema } from "@/lib/validations";
import { classifyTicket, findDuplicates, routeTicket } from "@/lib/ml-client";
import { categoryDisplayName } from "@/lib/categories";
import { emitTicketEvent, emitToAdmins } from "@/lib/socket-server";
import type { Prisma, TicketPriority } from "@prisma/client";

export async function GET(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const categoryId = searchParams.get("categoryId");
  const q = searchParams.get("q");

  const where: Prisma.TicketWhereInput = {};
  if (user.role === "USER") where.raisedById = user.id;
  if (user.role === "AGENT") where.assignedToId = user.id;
  // ADMIN sees all tickets — no extra filter.

  if (status) where.status = status as Prisma.EnumTicketStatusFilter["equals"];
  if (priority) where.priority = priority as TicketPriority;
  if (categoryId) where.categoryId = categoryId;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      category: true,
      raisedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
    },
    take: 200,
  });

  return NextResponse.json(tickets);
}

export async function POST(req: Request) {
  const auth = await requireUser(["USER"]);
  if ("error" in auth) return auth.error;
  const { user } = auth;

  const body = await req.json();
  const parsed = ticketCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { title, description } = parsed.data;

  // Best-effort AI classification — ticket creation must not fail if the ML service is down.
  const classification = await classifyTicket(title, description);

  let categoryId: string | null = null;
  if (classification?.category) {
    const category = await prisma.category.upsert({
      where: { slug: classification.category },
      update: {},
      create: {
        name: categoryDisplayName(classification.category),
        slug: classification.category,
      },
    });
    categoryId = category.id;
  }

  const embedding = classification?.embedding ?? [];

  let duplicateOfId: string | null = null;
  let similarityScore: number | null = null;
  if (embedding.length > 0) {
    const dupes = await findDuplicates(embedding);
    const best = dupes?.matches?.[0];
    if (best && best.similarity >= 0.8) {
      duplicateOfId = best.ticketId;
      similarityScore = best.similarity;
    }
  }

  // Route to the best-fit agent using workload + category track record.
  let assignedToId: string | null = null;
  let aiSuggestedScore: number | null = null;
  if (categoryId) {
    const agents = await prisma.user.findMany({
      where: { role: "AGENT" },
      select: {
        id: true,
        ticketsAssigned: { where: { status: { in: ["OPEN", "IN_PROGRESS"] } }, select: { id: true } },
        agentProfile: {
          select: { categoryStats: { where: { categoryId }, select: { avgResolutionMins: true, accuracyScore: true } } },
        },
      },
    });

    if (agents.length > 0) {
      const agentInputs = agents.map((a) => {
        const stat = a.agentProfile?.categoryStats[0];
        return {
          id: a.id,
          openCount: a.ticketsAssigned.length,
          avgResolutionMins: stat?.avgResolutionMins ?? 120,
          accuracyScore: stat?.accuracyScore ?? 0.5,
        };
      });
      const routed = await routeTicket(classification?.category ?? "general", agentInputs);
      if (routed?.agentId) {
        assignedToId = routed.agentId;
        aiSuggestedScore = routed.score;
      }
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      raisedById: user.id,
      categoryId,
      priority: classification?.priority ?? "MEDIUM",
      aiCategory: classification?.category,
      aiPriority: classification?.priority,
      aiConfidence: classification?.confidence,
      aiSuggestedAgentId: assignedToId,
      assignedToId,
      embedding,
      duplicateOfId,
      similarityScore,
    },
    include: { category: true, raisedBy: { select: { id: true, name: true, email: true } } },
  });

  if (assignedToId) {
    await prisma.assignmentLog.create({
      data: {
        ticketId: ticket.id,
        aiSuggestedAgentId: assignedToId,
        aiSuggestedScore,
        finalAgentId: assignedToId,
        wasOverridden: false,
      },
    });
  }

  emitTicketEvent("ticket:created", { ticketId: ticket.id, raisedById: ticket.raisedById, assignedToId: ticket.assignedToId });
  emitToAdmins("ticket:created", { ticketId: ticket.id });

  return NextResponse.json(ticket, { status: 201 });
}
