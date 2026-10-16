import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-utils";
import { retrainModel } from "@/lib/ml-client";

export async function POST() {
  const auth = await requireUser(["ADMIN"]);
  if ("error" in auth) return auth.error;

  const result = await retrainModel();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
