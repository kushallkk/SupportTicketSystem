const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

export type ClassifyResult = {
  category: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  embedding: number[];
};

export type DuplicateMatch = {
  ticketId: string;
  similarity: number;
};

export type RouteResult = {
  agentId: string | null;
  score: number | null;
  breakdown: { workload: number; categoryAccuracy: number; avgResolutionMins: number } | null;
};

/** Shared secret the ML service checks on every call except /health (see ML_API_KEY in ml-service/main.py). */
function authHeaders(): Record<string, string> {
  const key = process.env.ML_API_KEY;
  return key ? { "x-api-key": key } : {};
}

async function safeFetch<T>(path: string, init: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeaders(), ...init.headers },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // ML microservice is optional in dev — ticket creation still succeeds without it.
    return null;
  }
}

export function classifyTicket(title: string, description: string) {
  return safeFetch<ClassifyResult>("/classify", {
    method: "POST",
    body: JSON.stringify({ title, description }),
  });
}

export function findDuplicates(embedding: number[], excludeTicketId?: string) {
  return safeFetch<{ matches: DuplicateMatch[] }>("/duplicates", {
    method: "POST",
    body: JSON.stringify({ embedding, exclude_ticket_id: excludeTicketId }),
  });
}

export function routeTicket(
  category: string,
  agents: { id: string; openCount: number; avgResolutionMins: number; accuracyScore: number }[]
) {
  return safeFetch<RouteResult>("/route", {
    method: "POST",
    body: JSON.stringify({ category, agents }),
  });
}

export type ModelScore = { accuracy: number; macro_f1: number; n: number };
export type ModelInfo = {
  source: "built-in" | "trained";
  trained_at: string;
  sources: Record<string, number>;
  benchmark: null | {
    baseline_tfidf: { category: ModelScore; priority: ModelScore };
    current: { category: ModelScore; priority: ModelScore };
    candidate: { category: ModelScore; priority: ModelScore };
  };
};

export function getModelInfo() {
  return safeFetch<ModelInfo>("/model", { method: "GET" });
}

export type RetrainOutcome =
  | { ok: true; promoted: boolean; saved: boolean; reason: string; sources: Record<string, number> }
  | { ok: false; status: number; error: string };

/** Retraining takes a while (it embeds the benchmark), so it gets a far longer timeout than other calls. */
export async function retrainModel(): Promise<RetrainOutcome> {
  const token = process.env.ML_ADMIN_TOKEN;
  if (!token) {
    return { ok: false, status: 503, error: "Retraining isn't configured: set ML_ADMIN_TOKEN for the web app and the ML service." };
  }
  try {
    const res = await fetch(`${ML_SERVICE_URL}/retrain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(), "x-admin-token": token },
      body: JSON.stringify({ save: true }),
      signal: AbortSignal.timeout(120_000),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, promoted: body.promoted, saved: body.saved, reason: body.reason, sources: body.sources };
    const detail = typeof body.detail === "string" ? body.detail : "The ML service refused the request.";
    if (res.status === 403) {
      return { ok: false, status: 502, error: "The ML service rejected the admin token. ML_ADMIN_TOKEN must match in both places." };
    }
    return { ok: false, status: res.status === 409 ? 409 : 502, error: detail };
  } catch {
    return { ok: false, status: 502, error: "Couldn't reach the ML service." };
  }
}
