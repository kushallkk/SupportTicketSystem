// Deterministic stand-in for the FastAPI ML service, used only by the Playwright suite.
// It speaks the same contract as ml-service/main.py (the pytest suite pins that contract),
// so the browser tests don't need torch/sentence-transformers or any network access.
//
//   POST /classify    { title, description } -> { category, priority, confidence, embedding }
//   POST /duplicates  { embedding }          -> { matches }   (matches are set by tests via /__config)
//   POST /route       { category, agents }   -> { agentId, score, breakdown }  (least open tickets wins)
//   POST /__config    { matches }            -> test hook
import http from "node:http";

const port = Number(process.env.ML_STUB_PORT ?? 8001);
let duplicateMatches = [];
let modelTrained = false;
const ADMIN_TOKEN = "e2e-admin-token";
const score = (a) => ({ category: { accuracy: a, macro_f1: a, n: 100 }, priority: { accuracy: 0.7, macro_f1: 0.7, n: 100 } });

const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const readJson = (req) =>
  new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => resolve(raw ? JSON.parse(raw) : {}));
  });

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { status: "ok" });
    if (req.method === "GET" && req.url === "/model") {
      return send(res, 200, {
        source: modelTrained ? "trained" : "built-in",
        trained_at: new Date().toISOString(),
        sources: modelTrained ? { builtin: 54, "admin-corrections": 2 } : { builtin: 54 },
        benchmark: modelTrained ? { baseline_tfidf: score(0.64), current: score(0.91), candidate: score(0.93) } : null,
      });
    }
    const body = await readJson(req);

    if (req.url === "/classify") {
      const text = `${body.title} ${body.description}`.toLowerCase();
      const isAccount = text.includes("password");
      return send(res, 200, {
        category: isAccount ? "account" : "other",
        priority: isAccount ? "HIGH" : "LOW",
        confidence: 0.87,
        embedding: isAccount ? [1, 0] : [0, 1],
      });
    }

    if (req.url === "/duplicates") return send(res, 200, { matches: duplicateMatches });

    if (req.url === "/route") {
      const agents = [...(body.agents ?? [])].sort((a, b) => a.openCount - b.openCount || a.id.localeCompare(b.id));
      if (agents.length === 0) return send(res, 200, { agentId: null, score: null, breakdown: null });
      const best = agents[0];
      return send(res, 200, {
        agentId: best.id,
        score: 0.8,
        breakdown: { workload: 1 / (1 + best.openCount), categoryAccuracy: best.accuracyScore, avgResolutionMins: best.avgResolutionMins },
      });
    }

    if (req.url === "/retrain") {
      if (req.headers["x-admin-token"] !== ADMIN_TOKEN) return send(res, 403, { detail: "Invalid admin token." });
      modelTrained = true;
      return send(res, 200, {
        promoted: true, saved: true, reason: "Candidate is not worse than the current model on the benchmark.",
        sources: { builtin: 54, "admin-corrections": 2 }, benchmark: {},
      });
    }

    if (req.url === "/__config") {
      duplicateMatches = body.matches ?? [];
      modelTrained = false;
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: "not found" });
  })
  .listen(port, () => console.log(`ML stub listening on :${port}`));
