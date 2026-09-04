import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { commentCreateSchema } from "@/lib/validations";
import { emitTicketEvent } from "@/lib/socket-server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (user.role === "USER" && ticket.raisedById !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "AGENT" && ticket.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = commentCreateSchema.safeParse({ ...body, ticketId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // Only agents/admins may post internal notes; force false for regular users.
  const isInternal = user.role === "USER" ? false : parsed.data.isInternal;

  const comment = await prisma.comment.create({
    data: { ticketId: id, authorId: user.id, body: parsed.data.body, isInternal },
    include: { author: { select: { id: true, name: true, role: true } } },
  });

  if (!ticket.firstResponseAt && user.id !== ticket.raisedById) {
    await prisma.ticket.update({ where: { id }, data: { firstResponseAt: new Date() } });
  }

  emitTicketEvent("ticket:comment", { ticketId: id, raisedById: ticket.raisedById, assignedToId: ticket.assignedToId });

  return NextResponse.json(comment, { status: 201 });
}
