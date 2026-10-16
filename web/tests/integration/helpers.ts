import { vi, type Mock } from "vitest";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@prisma/client";

export type TestUser = Awaited<ReturnType<typeof makeUser>>;

let counter = 0;

export async function makeUser(role: Role, name = `${role.toLowerCase()}-${++counter}`) {
  return prisma.user.create({
    data: {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}-${counter}@test.dev`,
      passwordHash: "not-a-real-hash",
      role,
      ...(role === "AGENT" ? { agentProfile: { create: {} } } : {}),
    },
  });
}

export function loginAs(user: TestUser) {
  (auth as unknown as Mock).mockResolvedValue({
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  });
}

export function logout() {
  (auth as unknown as Mock).mockResolvedValue(null);
}

export function jsonRequest(method: string, body?: unknown, url = "http://localhost/api/test") {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

export async function makeCategory(slug: string, name = slug) {
  return prisma.category.create({ data: { slug, name } });
}

export async function makeTicket(
  raisedById: string,
  overrides: Partial<Prisma.TicketUncheckedCreateInput> = {}
) {
  return prisma.ticket.create({
    data: {
      title: "Test ticket title",
      description: "A test ticket description long enough to be valid",
      raisedById,
      ...overrides,
    },
  });
}

export const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
export const hoursAgo = (h: number) => minutesAgo(h * 60);
