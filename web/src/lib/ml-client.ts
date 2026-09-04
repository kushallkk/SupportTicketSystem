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

async function safeFetch<T>(path: string, init: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
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
