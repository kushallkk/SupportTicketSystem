import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";

export type AuthedUser = Session["user"];

// Explicit (rather than inferred) so TypeScript treats this as a real discriminated union:
// inferred, it widens to `{ error; user?: undefined } | { user; error?: undefined }` and
// `"error" in result` no longer narrows `result.error` away from `undefined`.
export type RequireUserResult = { error: NextResponse } | { user: AuthedUser };

export async function requireUser(roles?: Role[]): Promise<RequireUserResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (roles && !roles.includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: session.user };
}
