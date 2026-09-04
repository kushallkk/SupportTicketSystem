import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { ratingSchema } from "@/lib/validations";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(["USER"]);
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.raisedById !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
    return NextResponse.json({ error: "Ticket must be resolved before rating" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ratingSchema.safeParse({ ...body, ticketId: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const rating = await prisma.rating.upsert({
    where: { ticketId: id },
    update: { score: parsed.data.score, feedback: parsed.data.feedback },
    create: { ticketId: id, userId: user.id, score: parsed.data.score, feedback: parsed.data.feedback },
  });

  return NextResponse.json(rating, { status: 201 });
}
