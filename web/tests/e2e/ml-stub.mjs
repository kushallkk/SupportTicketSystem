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

    if (req.url === "/__config") {
      duplicateMatches = body.matches ?? [];
      return send(res, 200, { ok: true });
    }

    send(res, 404, { error: "not found" });
  })
  .listen(port, () => console.log(`ML stub listening on :${port}`));
