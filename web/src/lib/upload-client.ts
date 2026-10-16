export type UploadResult = { ok: true } | { ok: false; error: string };

/**
 * Uploads files to a ticket, optionally tied to a comment the caller just posted. One request per file:
 * serverless hosts cap the size of a single request body, so a batch of files would not fit in one.
 */
export async function uploadAttachments(ticketId: string, files: File[], commentId?: string): Promise<UploadResult> {
  const failures: string[] = [];

  for (const file of files) {
    const form = new FormData();
    form.append("files", file);
    if (commentId) form.append("commentId", commentId);

    try {
      const res = await fetch(`/api/tickets/${ticketId}/attachments`, { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        failures.push(data.error ?? `"${file.name}" failed to upload.`);
      }
    } catch {
      failures.push("Couldn't reach the server. Check your connection and try again.");
      break;
    }
  }

  return failures.length === 0 ? { ok: true } : { ok: false, error: failures[0] };
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
