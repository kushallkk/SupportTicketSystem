"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitMerge, Lightbulb, Loader2, Route, Sparkles, Wand2 } from "lucide-react";
import { TicketPageLayout } from "@/components/ticket-detail/page-layout";
import { FilePicker } from "@/components/attachments/file-picker";
import { uploadAttachments } from "@/lib/upload-client";

const NEXT_STEPS = [
  { icon: Wand2, title: "We read it", text: "AI predicts the category and priority within a second." },
  { icon: GitMerge, title: "We check for repeats", text: "If it matches an earlier ticket, you'll see the fix that worked." },
  { icon: Route, title: "We route it", text: "It goes to the best-suited agent with the lightest workload." },
];

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
    <TicketPageLayout
      asideLabel="What happens next"
      main={
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
      }
      aside={
        <>
          <section className="space-y-4 rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)] ring-1 ring-foreground/5">
            <h2 className="text-sm font-semibold tracking-tight">What happens next</h2>
            <ol className="space-y-4">
              {NEXT_STEPS.map(({ icon: Icon, title: t, text }, i) => (
                <li key={t} className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {i + 1}. {t}
                    </p>
                    <p className="text-xs text-muted-foreground">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl bg-accent/60 p-5">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold tracking-tight text-accent-foreground">
              <Lightbulb className="size-4" />
              Tips for a faster fix
            </h2>
            <ul className="list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>Say what you expected and what happened instead.</li>
              <li>Include exact error messages or a screenshot.</li>
              <li>One problem per ticket keeps routing accurate.</li>
            </ul>
          </section>
        </>
      }
    />
  );
}
