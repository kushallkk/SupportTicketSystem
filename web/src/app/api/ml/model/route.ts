import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-utils";
import { getModelInfo } from "@/lib/ml-client";

export async function GET() {
  const auth = await requireUser(["ADMIN"]);
  if ("error" in auth) return auth.error;

  const info = await getModelInfo();
  if (!info) return NextResponse.json({ available: false });
  return NextResponse.json({ available: true, ...info });
}
