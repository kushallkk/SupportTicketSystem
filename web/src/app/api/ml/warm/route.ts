import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-utils";
import { warmUpMl } from "@/lib/ml-client";

// Waiting for a cold ML service can take ~25 s.
export const maxDuration = 30;

/** Fire-and-forget wake-up call from the "Raise a ticket" page; signed-in users only so it can't be abused. */
export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ ready: await warmUpMl() });
}
