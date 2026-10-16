"""Scoring helpers shared by the training script and the tests."""

import json
from pathlib import Path

from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_recall_fscore_support

BENCHMARK_PATH = Path(__file__).parent / "eval" / "benchmark.json"
HOLDOUT_PATH = Path(__file__).parent / "eval" / "holdout.json"


def load_benchmark() -> list[dict]:
    return json.loads(BENCHMARK_PATH.read_text(encoding="utf-8"))


def load_holdout() -> list[dict]:
    """Sealed second test set. Never used for choosing models or settings; scored on request only."""
    return json.loads(HOLDOUT_PATH.read_text(encoding="utf-8"))


def benchmark_text(item: dict) -> str:
    # Same shape the API feeds the classifier: "<title>. <description>"
    return f"{item['title']}. {item['description']}"


def score(y_true: list[str], y_pred: list[str], labels: list[str]) -> dict:
    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    return {
        "n": len(y_true),
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)), 4),
        "per_class": {
            label: {
                "precision": round(float(p), 3), "recall": round(float(r), 3),
                "f1": round(float(f), 3), "support": int(s),
            }
            for label, p, r, f, s in zip(labels, precision, recall, f1, support)
        },
        "labels": labels,
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
    }


def evaluate_items(items: list[dict], predict_batch, category_labels: list[str], priority_labels: list[str]) -> dict:
    """`predict_batch(texts) -> [(category, priority, confidence), ...]`. Returns category/priority scores."""
    preds = predict_batch([benchmark_text(i) for i in items])
    cat = score([i["category"] for i in items], [p[0] for p in preds], category_labels)
    pri = score([i["priority"] for i in items], [p[1] for p in preds], priority_labels)

    correct = [p[2] for p, i in zip(preds, items) if p[0] == i["category"]]
    wrong = [p[2] for p, i in zip(preds, items) if p[0] != i["category"]]
    mean = lambda xs: round(sum(xs) / len(xs), 3) if xs else None
    cat["confidence"] = {
        "mean_all": mean([p[2] for p in preds]),
        "mean_when_correct": mean(correct),
        "mean_when_wrong": mean(wrong),
    }
    return {"category": cat, "priority": pri}


def evaluate_on_benchmark(predict, category_labels: list[str], priority_labels: list[str]) -> dict:
    """Single-text predictor convenience wrapper: `predict(text) -> (category, priority, confidence)`."""
    return evaluate_items(load_benchmark(), lambda texts: [predict(t) for t in texts], category_labels, priority_labels)
