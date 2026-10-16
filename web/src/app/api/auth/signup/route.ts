import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validations";

function codesMatch(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, email, password, role, agentCode } = parsed.data;

  // On a public deployment anyone could otherwise pick "Support agent" and start seeing customers' tickets.
  // Set AGENT_SIGNUP_CODE to require an invite code for agent accounts; unset, signup stays open (local dev).
  const requiredCode = process.env.AGENT_SIGNUP_CODE;
  if (role === "AGENT" && requiredCode && !codesMatch(agentCode ?? "", requiredCode)) {
    return NextResponse.json({ error: "That agent invite code isn't right. Ask an admin for the current one." }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      ...(role === "AGENT" ? { agentProfile: { create: {} } } : {}),
    },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
