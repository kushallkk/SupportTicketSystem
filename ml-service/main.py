import hmac
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import training
from classifier import classifier
from embeddings import embed
from duplicates import find_similar
from routing import pick_best_agent

@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Load the embedding model and the classifier before taking traffic, so the first real ticket
    # isn't the one that pays a ~10s warm-up (which used to blow the web app's request timeout).
    classifier.info()
    yield


app = FastAPI(title="ResolveIQ ML service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_api_key(x_api_key: str | None = Header(default=None)):
    """
    Shared secret between the web app and this service. When deployed the service has a public URL, so
    without this anyone could call it. Not enforced when ML_API_KEY is unset, which keeps local dev easy.
    """
    expected = os.environ.get("ML_API_KEY")
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(status_code=401, detail="Missing or invalid API key.")


protected = [Depends(require_api_key)]


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


@app.post("/classify", response_model=ClassifyResponse, dependencies=protected)
def classify(req: ClassifyRequest):
    text = f"{req.title}. {req.description}"
    vector = embed(text)
    category, priority, confidence = classifier.predict(text, vector)  # reuse the embedding: no second pass
    return ClassifyResponse(category=category, priority=priority, confidence=confidence, embedding=vector)


@app.post("/duplicates", response_model=DuplicatesResponse, dependencies=protected)
def duplicates(req: DuplicatesRequest):
    matches = find_similar(req.embedding, req.exclude_ticket_id)
    return DuplicatesResponse(matches=matches)


@app.post("/route", response_model=RouteResponse, dependencies=protected)
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


@app.get("/model", dependencies=protected)
def model_info():
    """Which model is serving, when it was trained, on what, and how it scored on the benchmark."""
    return classifier.info()


class RetrainRequest(BaseModel):
    save: bool = True


@app.post("/retrain", dependencies=protected)
def retrain(req: RetrainRequest | None = None, x_admin_token: str | None = Header(default=None)):
    """
    Retrains on the built-in examples plus admin corrections from the database. The new model only
    replaces the current one if it isn't meaningfully worse on the benchmark.
    Protected by ML_ADMIN_TOKEN; disabled entirely if that isn't configured.
    """
    expected = os.environ.get("ML_ADMIN_TOKEN")
    if not expected:
        raise HTTPException(status_code=503, detail="Retraining is disabled: ML_ADMIN_TOKEN is not set.")
    if not x_admin_token or not hmac.compare_digest(x_admin_token, expected):
        raise HTTPException(status_code=403, detail="Invalid admin token.")

    try:
        report = training.run(use_db=True, save=(req.save if req else True), current_artifact=classifier._get())
    except training.TrainingBusy as busy:
        raise HTTPException(status_code=409, detail=str(busy))

    report.pop("_candidate", None)
    if report["saved"]:
        classifier.reload()
    return {
        "promoted": report["promoted"],
        "saved": report["saved"],
        "reason": report["reason"],
        "sources": report["sources"],
        "benchmark": {k: training._summarise(v) for k, v in report["benchmark"].items()},
    }
