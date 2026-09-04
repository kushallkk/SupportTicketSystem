import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("error" in auth) return auth.error;

  const agents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      ticketsAssigned: {
        select: { id: true, status: true },
      },
      agentProfile: {
        select: {
          categoryStats: {
            include: { category: { select: { name: true, slug: true } } },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const shaped = agents.map((a) => {
    const openCount = a.ticketsAssigned.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
    const resolvedCount = a.ticketsAssigned.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      createdAt: a.createdAt,
      openCount,
      resolvedCount,
      totalCount: a.ticketsAssigned.length,
      categoryStats: a.agentProfile?.categoryStats ?? [],
    };
  });

  return NextResponse.json(shaped);
}
