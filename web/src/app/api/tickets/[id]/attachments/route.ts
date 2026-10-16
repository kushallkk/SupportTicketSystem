import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/api-utils";
import { canAccessTicket } from "@/lib/ticket-access";
import { getStorage, newStorageKey } from "@/lib/storage";
import { emitTicketEvent } from "@/lib/socket-server";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, checkBatchSize, validateUpload } from "@/lib/attachment-rules";

// Generous ceiling for multipart overhead; each file is still checked against MAX_FILE_BYTES below.
const MAX_REQUEST_BYTES = MAX_FILES_PER_UPLOAD * MAX_FILE_BYTES + 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { user } = auth;
  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { id: true, raisedById: true, assignedToId: true },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAccessTicket(user.role, user.id, ticket)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (Number(req.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return NextResponse.json({ error: "Upload is too large." }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart/form-data upload." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => typeof f !== "string");

  // Optionally tie the files to one of the uploader's own comments on this ticket.
  let commentId: string | null = null;
  let isInternal = false;
  const requestedComment = form.get("commentId");
  if (typeof requestedComment === "string" && requestedComment) {
    const comment = await prisma.comment.findUnique({ where: { id: requestedComment } });
    if (!comment || comment.ticketId !== id) {
      return NextResponse.json({ error: "Comment not found on this ticket." }, { status: 400 });
    }
    if (comment.authorId !== user.id) {
      return NextResponse.json({ error: "You can only attach files to your own comments." }, { status: 403 });
    }
    commentId = comment.id;
    isInternal = comment.isInternal; // files on an internal note stay hidden from the requester
  }

  const existing = await prisma.attachment.count({ where: { ticketId: id } });
  const batch = checkBatchSize(existing, files.length);
  if (!batch.ok) return NextResponse.json({ error: batch.error }, { status: 400 });

  // Validate everything before storing anything, so an upload is all-or-nothing.
  const accepted: { fileName: string; mimeType: string; bytes: Uint8Array }[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = validateUpload({ name: file.name, size: bytes.length, bytes });
    if (result.ok) accepted.push({ fileName: result.fileName, mimeType: result.mimeType, bytes });
    else errors.push(result.error);
  }
  if (errors.length) return NextResponse.json({ error: errors[0], errors }, { status: 400 });

  const storage = getStorage();
  const storedKeys: string[] = [];
  try {
    const created = [];
    for (const file of accepted) {
      const storageKey = newStorageKey(id);
      await storage.put(storageKey, file.bytes);
      storedKeys.push(storageKey);
      created.push(
        await prisma.attachment.create({
          data: {
            ticketId: id, commentId, uploadedById: user.id, isInternal,
            fileName: file.fileName, mimeType: file.mimeType, fileSize: file.bytes.length, storageKey,
          },
          select: { id: true, fileName: true, fileSize: true, mimeType: true, commentId: true, isInternal: true, createdAt: true },
        })
      );
    }
    emitTicketEvent("ticket:updated", { ticketId: id, raisedById: ticket.raisedById, assignedToId: ticket.assignedToId });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // Don't leave orphaned bytes (or half an upload) behind.
    await prisma.attachment.deleteMany({ where: { storageKey: { in: storedKeys } } }).catch(() => {});
    await Promise.all(storedKeys.map((k) => storage.delete(k).catch(() => {})));
    console.error("Attachment upload failed", error);
    return NextResponse.json({ error: "Couldn't save the upload. Please try again." }, { status: 500 });
  }
}
