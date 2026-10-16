export type UploadResult = { ok: true } | { ok: false; error: string };

/** Uploads files to a ticket, optionally tied to a comment the caller just posted. */
export async function uploadAttachments(ticketId: string, files: File[], commentId?: string): Promise<UploadResult> {
  if (files.length === 0) return { ok: true };

  const form = new FormData();
  files.forEach((file) => form.append("files", file));
  if (commentId) form.append("commentId", commentId);

  try {
    const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: form });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Upload failed." };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}

export async function deleteAttachment(attachmentId: string): Promise<UploadResult> {
  try {
    const res = await fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "Couldn't remove the file." };
  } catch {
    return { ok: false, error: "Couldn't reach the server." };
  }
}
