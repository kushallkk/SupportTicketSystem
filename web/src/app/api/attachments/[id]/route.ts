import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { canAccessTicket } from "@/lib/ticket-access";
import { getStorage } from "@/lib/storage";
import { isInlineImage } from "@/lib/attachment-rules";
import { emitTicketEvent } from "@/lib/socket-server";

async function loadAttachment(id: string) {
  return prisma.attachment.findUnique({
    where: { id },
    include: { ticket: { select: { id: true, raisedById: true, assignedToId: true } } },
  });
}

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const attachment = await loadAttachment(id);
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessTicket(user.role, user.id, attachment.ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  // Files on internal notes don't exist as far as the requester is concerned.
  if (user.role === "USER" && attachment.isInternal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = await getStorage().get(attachment.storageKey);
  if (!data) return NextResponse.json({ error: "File is missing from storage" }, { status: 404 });

  const forceDownload = new URL(req.url).searchParams.get("download") === "1";
  const inline = isInlineImage(attachment.mimeType) && !forceDownload;

  return new Response(data as BodyInit, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": contentDisposition(inline ? "inline" : "attachment", attachment.fileName),
      // Uploaded files are untrusted: never let the browser guess a type or run anything from them.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const attachment = await loadAttachment(id);
  if (!attachment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessTicket(user.role, user.id, attachment.ticket)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (user.role === "USER" && attachment.isInternal) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.role !== "ADMIN" && attachment.uploadedById !== user.id) {
    return NextResponse.json({ error: "Only the uploader or an admin can remove a file." }, { status: 403 });
  }

  await prisma.attachment.delete({ where: { id } });
  await getStorage().delete(attachment.storageKey).catch((e) => console.error("Failed to delete stored file", e));
  emitTicketEvent("ticket:updated", {
    ticketId: attachment.ticket.id, raisedById: attachment.ticket.raisedById, assignedToId: attachment.ticket.assignedToId,
  });
  return NextResponse.json({ ok: true });
}
