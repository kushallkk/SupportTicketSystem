from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from classifier import classifier
from embeddings import embed
from duplicates import find_similar
from routing import pick_best_agent

app = FastAPI(title="ResolveIQ ML service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ClassifyRequest(BaseModel):
    title: str
    description: str


class ClassifyResponse(BaseModel):
    category: str
    priority: str
    confidence: float
    embedding: list[float]


class DuplicatesRequest(BaseModel):
    embedding: list[float]
    exclude_ticket_id: str | None = None


class DuplicateMatch(BaseModel):
    ticketId: str
    similarity: float


class DuplicatesResponse(BaseModel):
    matches: list[DuplicateMatch]


class AgentInput(BaseModel):
    id: str
    openCount: int
    avgResolutionMins: float
    accuracyScore: float


class RouteRequest(BaseModel):
    category: str
    agents: list[AgentInput]


class RouteBreakdown(BaseModel):
    workload: float
    categoryAccuracy: float
    avgResolutionMins: float


class RouteResponse(BaseModel):
    agentId: str | None
    score: float | None
    breakdown: RouteBreakdown | None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest):
    text = f"{req.title}. {req.description}"
    category, priority, confidence = classifier.predict(text)
    vector = embed(text)
    return ClassifyResponse(category=category, priority=priority, confidence=confidence, embedding=vector)


@app.post("/duplicates", response_model=DuplicatesResponse)
def duplicates(req: DuplicatesRequest):
    matches = find_similar(req.embedding, req.exclude_ticket_id)
    return DuplicatesResponse(matches=matches)


@app.post("/route", response_model=RouteResponse)
def route(req: RouteRequest):
    agent_id, score, breakdown = pick_best_agent([a.model_dump() for a in req.agents])
    if agent_id is None or breakdown is None:
        return RouteResponse(agentId=None, score=None, breakdown=None)
    return RouteResponse(
        agentId=agent_id,
        score=score,
        breakdown=RouteBreakdown(
            workload=breakdown["workload"],
            categoryAccuracy=breakdown["categoryAccuracy"],
            avgResolutionMins=breakdown["avgResolutionMins"],
        ),
    )
