"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Brain, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/ticket-display";
import type { ModelInfo } from "@/lib/ml-client";

type State = { available: false } | ({ available: true } & ModelInfo);

const pct = (n: number) => `${Math.round(n * 100)}%`;

function describeSources(sources: Record<string, number>) {
  const parts = [`${sources.builtin ?? 0} built-in examples`];
  if (sources["admin-corrections"]) parts.push(`${sources["admin-corrections"]} admin correction${sources["admin-corrections"] === 1 ? "" : "s"}`);
  return parts.join(" + ");
}

/** Which classifier is live, how it scored, and a button to retrain it from admins' overrides. */
export function ModelCard() {
  const [state, setState] = useState<State | null>(null);
  const [retraining, setRetraining] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/ml/model");
    setState(res.ok ? await res.json() : { available: false });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load, same pattern as the other admin pages
    load();
  }, [load]);

  async function retrain() {
    setRetraining(true);
    const res = await fetch("/api/ml/retrain", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setRetraining(false);

    if (!res.ok) {
      toast.error(data.error ?? "Retraining failed.");
      return;
    }
    if (data.saved) toast.success(`New model is live. ${describeSources(data.sources)}.`);
    else toast.info(data.reason);
    load();
  }

  const bench = state?.available ? state.benchmark : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="size-4 text-primary" />
          AI model
        </CardTitle>
        <Button size="sm" variant="outline" onClick={retrain} disabled={retraining || !state?.available}>
          {retraining ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Retrain from corrections
        </Button>
      </CardHeader>
      <CardContent className="space-y-1 text-sm" data-testid="model-card">
        {!state && <Skeleton className="h-10 w-full" />}
        {state && !state.available && (
          <p className="text-muted-foreground">The ML service isn&apos;t reachable, so classification and routing are paused.</p>
        )}
        {state?.available && (
          <>
            <p>
              <span className="font-medium">{state.source === "trained" ? "Retrained model" : "Built-in model"}</span>
              <span className="text-muted-foreground"> · {describeSources(state.sources)} · trained {timeAgo(state.trained_at)}</span>
            </p>
            {bench ? (
              <p className="text-muted-foreground">
                Category accuracy on our independent test set:{" "}
                <span className="font-medium text-foreground">{pct(bench.candidate.category.accuracy)}</span> (the original model
                scored {pct(bench.baseline_tfidf.category.accuracy)}).
              </p>
            ) : (
              <p className="text-muted-foreground">
                When admins change a ticket&apos;s category or priority, retraining learns from it. A new model only goes live if it
                isn&apos;t worse on a fixed test set.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
