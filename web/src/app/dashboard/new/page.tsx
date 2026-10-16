"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles } from "lucide-react";
import { FilePicker } from "@/components/attachments/file-picker";
import { uploadAttachments } from "@/lib/upload-client";

export default function NewTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Couldn't create the ticket");
      setLoading(false);
      return;
    }

    const ticket = await res.json();
    if (files.length > 0) {
      const uploaded = await uploadAttachments(ticket.id, files);
      if (!uploaded.ok) {
        // The ticket exists either way; don't lose it over a failed attachment.
        toast.warning(`Ticket created, but the attachments weren't saved: ${uploaded.error}`);
        router.push(`/dashboard/${ticket.id}`);
        return;
      }
    }
    toast.success("Ticket created — routed automatically");
    router.push(`/dashboard/${ticket.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Sparkles className="size-4" />
            </div>
            <div>
              <CardTitle>Raise a ticket</CardTitle>
              <CardDescription>
                We&apos;ll classify, prioritize, and route it to the right agent automatically.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                required
                minLength={5}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of the issue"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                required
                minLength={10}
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happened? Steps to reproduce, error messages, anything that helps."
              />
            </div>
            <div className="space-y-2">
              <Label>Attachments (optional)</Label>
              <FilePicker files={files} onChange={setFiles} disabled={loading} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Submit ticket
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
