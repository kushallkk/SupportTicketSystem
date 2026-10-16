"""
Trains the ticket classifier and decides whether a newly trained model should replace the current one.

Model: logistic regression over sentence embeddings (all-MiniLM-L6-v2), one model for category and
one for priority. The embedding is the same vector /classify already computes for duplicate
detection, so classification costs nothing extra at request time.

Why not TF-IDF any more: on the independent benchmark (eval/benchmark.json, 100 hand-written tickets
that are never trained on) the old TF-IDF model scored 64% category accuracy; the same 54 training
examples through embeddings score ~91%. Embeddings generalise to paraphrases that share no words.
"""

import datetime as dt
import threading
from dataclasses import dataclass, field
from typing import Callable

import numpy as np
import sklearn
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline

import evaluate
import model_store
from training_data import CATEGORIES, EXAMPLES, PRIORITIES

C = 10.0
# A candidate may be this much worse than the current model on the benchmark and still be promoted:
# the benchmark has only 100 items, so smaller differences are noise, and admin corrections are
# *supposed* to move the model toward the admins' judgement.
PROMOTION_TOLERANCE = {"category": 0.03, "priority": 0.05}

EmbedFn = Callable[[list[str]], list[list[float]]]
_run_lock = threading.Lock()


class TrainingBusy(RuntimeError):
    pass


@dataclass
class TrainingSet:
    texts: list[str] = field(default_factory=list)
    categories: list[str | None] = field(default_factory=list)
    priorities: list[str | None] = field(default_factory=list)
    weights: list[float] = field(default_factory=list)
    sources: dict[str, int] = field(default_factory=dict)

    def add(self, text: str, category: str | None, priority: str | None, weight: float, source: str):
        self.texts.append(text)
        self.categories.append(category)
        self.priorities.append(priority)
        self.weights.append(weight)
        self.sources[source] = self.sources.get(source, 0) + 1


def builtin_set() -> TrainingSet:
    ts = TrainingSet()
    for text, category, priority in EXAMPLES:
        ts.add(text, category, priority, 1.0, "builtin")
    return ts


def _default_embed(texts: list[str]) -> list[list[float]]:
    from embeddings import embed_many

    return embed_many(texts)


def _fit_one(X: np.ndarray, y: list[str | None], weights: list[float]) -> LogisticRegression:
    keep = [i for i, label in enumerate(y) if label is not None]
    model = LogisticRegression(max_iter=3000, class_weight="balanced", C=C)
    model.fit(X[keep], [y[i] for i in keep], sample_weight=[weights[i] for i in keep])
    return model


def fit(ts: TrainingSet, embed: EmbedFn | None = None) -> dict:
    """Trains both models and returns the artifact dict (see model_store)."""
    X = np.array((embed or _default_embed)(ts.texts))
    return {
        "format": model_store.FORMAT,
        "embedding_model": model_store.EMBEDDING_MODEL,
        "sklearn_version": sklearn.__version__,
        "trained_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "category_model": _fit_one(X, ts.categories, ts.weights),
        "priority_model": _fit_one(X, ts.priorities, ts.weights),
        "sources": dict(ts.sources),
    }


def train_builtin(embed: EmbedFn | None = None) -> dict:
    return fit(builtin_set(), embed)


def predict_vectors(artifact: dict, vectors: np.ndarray) -> list[tuple[str, str, float]]:
    category_model, priority_model = artifact["category_model"], artifact["priority_model"]
    category_proba = category_model.predict_proba(vectors)
    categories = category_model.classes_[category_proba.argmax(axis=1)]
    priorities = priority_model.predict(vectors)
    return [
        (str(c), str(p), float(row.max())) for c, p, row in zip(categories, priorities, category_proba)
    ]


def _predict_batch(artifact: dict, embed: EmbedFn | None) -> Callable[[list[str]], list[tuple[str, str, float]]]:
    return lambda texts: predict_vectors(artifact, np.array((embed or _default_embed)(texts)))


class TfidfBaseline:
    """The original model, kept only so every report can say how much better (or worse) we now are."""

    def __init__(self) -> None:
        texts = [t for t, _, _ in EXAMPLES]
        self.category = make_pipeline(
            TfidfVectorizer(ngram_range=(1, 2), stop_words="english"),
            LogisticRegression(max_iter=1000, class_weight="balanced"),
        ).fit(texts, [c for _, c, _ in EXAMPLES])
        self.priority = make_pipeline(
            TfidfVectorizer(ngram_range=(1, 2), stop_words="english"),
            LogisticRegression(max_iter=1000, class_weight="balanced"),
        ).fit(texts, [p for _, _, p in EXAMPLES])

    def predict_batch(self, texts: list[str]) -> list[tuple[str, str, float]]:
        proba = self.category.predict_proba(texts)
        cats = self.category.classes_[proba.argmax(axis=1)]
        pris = self.priority.predict(texts)
        return [(str(c), str(p), float(r.max())) for c, p, r in zip(cats, pris, proba)]


def _summarise(result: dict) -> dict:
    """Compact view for reports and the admin UI (full confusion matrices stay in the saved metrics)."""
    return {
        kind: {"accuracy": result[kind]["accuracy"], "macro_f1": result[kind]["macro_f1"], "n": result[kind]["n"]}
        for kind in ("category", "priority")
    }


def run(
    *,
    embed: EmbedFn | None = None,
    use_db: bool = False,
    public_examples: list | None = None,
    save: bool = False,
    include_holdout: bool = False,
    current_artifact: dict | None = None,
    corrections: list | None = None,
) -> dict:
    """
    Trains a candidate, scores it against the baseline and the currently serving model on the
    benchmark, and (if `save`) writes it only when it is not meaningfully worse than the current one.

    `corrections` can be passed in (tests); otherwise `use_db` loads admin overrides from Postgres.
    """
    if not _run_lock.acquire(blocking=False):
        raise TrainingBusy("A training run is already in progress.")
    try:
        ts = builtin_set()
        if use_db and corrections is None:
            from db_data import load_corrections

            corrections = load_corrections(CATEGORIES, PRIORITIES)
        for c in corrections or []:
            ts.add(c.text, c.category, c.priority, c.weight, "admin-corrections")
        for e in public_examples or []:
            ts.add(e.text, e.category, None, 1.0, e.source)  # public priorities proved to be noise: never used

        _guard_against_leakage(ts)

        benchmark = evaluate.load_benchmark()
        candidate = fit(ts, embed)
        current = current_artifact or train_builtin(embed)

        def score(predict_batch, items):
            return evaluate.evaluate_items(items, predict_batch, CATEGORIES, PRIORITIES)

        report: dict = {
            "trained_at": candidate["trained_at"],
            "sources": candidate["sources"],
            "benchmark": {
                "baseline_tfidf": score(TfidfBaseline().predict_batch, benchmark),
                "current": score(_predict_batch(current, embed), benchmark),
                "candidate": score(_predict_batch(candidate, embed), benchmark),
            },
        }
        if include_holdout:
            holdout = evaluate.load_holdout()
            report["holdout"] = {
                "baseline_tfidf": score(TfidfBaseline().predict_batch, holdout),
                "candidate": score(_predict_batch(candidate, embed), holdout),
            }

        cand, cur = report["benchmark"]["candidate"], report["benchmark"]["current"]
        regressions = [
            f"{kind} macro-F1 {cand[kind]['macro_f1']:.3f} vs current {cur[kind]['macro_f1']:.3f}"
            for kind in ("category", "priority")
            if cand[kind]["macro_f1"] < cur[kind]["macro_f1"] - PROMOTION_TOLERANCE[kind]
        ]
        report["promoted"] = not regressions
        report["reason"] = (
            "Candidate is not worse than the current model on the benchmark."
            if not regressions
            else "Kept the current model; candidate regressed: " + "; ".join(regressions)
        )
        if save and report["promoted"]:
            summary = {
                "trained_at": candidate["trained_at"],
                "sources": candidate["sources"],
                "benchmark": {k: _summarise(v) for k, v in report["benchmark"].items()},
                "full": report,
            }
            model_store.save(candidate, summary)
            report["saved"] = True
        else:
            report["saved"] = False
        report["_candidate"] = candidate  # for callers that want to use it directly; stripped from JSON output
        return report
    finally:
        _run_lock.release()


def _guard_against_leakage(ts: TrainingSet) -> None:
    """Training on a benchmark or hold-out ticket would silently inflate every score."""
    norm = lambda s: " ".join(s.lower().split())
    forbidden = {
        norm(evaluate.benchmark_text(i)) for i in evaluate.load_benchmark() + evaluate.load_holdout()
    }
    leaked = [t for t in ts.texts if norm(t) in forbidden]
    if leaked:
        raise ValueError(f"{len(leaked)} training example(s) are identical to benchmark/hold-out tickets: {leaked[:2]}")
