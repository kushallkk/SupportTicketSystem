import math

from fastapi.testclient import TestClient

import duplicates
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_classify_response_shape():
    res = client.post("/classify", json={
        "title": "Cannot reset my password",
        "description": "The reset email never arrives even after checking spam.",
    })
    assert res.status_code == 200
    body = res.json()
    assert body["category"] == "account"
    assert body["priority"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
    assert 0.0 <= body["confidence"] <= 1.0
    # all-MiniLM-L6-v2 -> 384 dims, L2-normalized (duplicates.py relies on dot product == cosine)
    assert len(body["embedding"]) == 384
    assert math.isclose(sum(x * x for x in body["embedding"]), 1.0, abs_tol=1e-3)


def test_classify_rejects_missing_fields():
    assert client.post("/classify", json={"title": "only a title"}).status_code == 422


def test_similar_wording_embeds_closer_than_unrelated():
    def emb(title, desc):
        return client.post("/classify", json={"title": title, "description": desc}).json()["embedding"]

    a = emb("Cannot reset my password", "The reset email never arrives")
    b = emb("Can't reset my password at all", "Forgot password email does not arrive")
    c = emb("Please add PDF export", "Would love to export reports as PDF files")
    dot = lambda x, y: sum(p * q for p, q in zip(x, y))
    assert dot(a, b) > 0.8
    assert dot(a, b) > dot(a, c) + 0.2


def test_route_picks_least_loaded_agent():
    res = client.post("/route", json={
        "category": "technical",
        "agents": [
            {"id": "busy", "openCount": 8, "avgResolutionMins": 400, "accuracyScore": 0.5},
            {"id": "free", "openCount": 1, "avgResolutionMins": 90, "accuracyScore": 0.85},
        ],
    })
    assert res.status_code == 200
    assert res.json()["agentId"] == "free"


def test_route_with_no_agents():
    res = client.post("/route", json={"category": "billing", "agents": []})
    assert res.json() == {"agentId": None, "score": None, "breakdown": None}


def test_duplicates_endpoint_returns_matches(monkeypatch):
    monkeypatch.setattr(
        duplicates, "find_similar",
        lambda emb, exclude, limit=5: [{"ticketId": "t1", "similarity": 0.97}],
    )
    # main.py imported the function by name, so patch it there too.
    import main
    monkeypatch.setattr(main, "find_similar", duplicates.find_similar)
    res = client.post("/duplicates", json={"embedding": [0.1, 0.2]})
    assert res.json() == {"matches": [{"ticketId": "t1", "similarity": 0.97}]}
