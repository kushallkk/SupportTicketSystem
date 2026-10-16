"""
Serving-time classifier.

Uses the model saved by training.py (models/classifier.joblib) when there is one; otherwise it
trains from the built-in examples the first time it is needed, which takes about a second and means
a fresh clone works with no setup. See training.py for what the model is and how it is evaluated.
"""

import threading

import numpy as np

import model_store
import training


class TicketClassifier:
    def __init__(self) -> None:
        self._artifact: dict | None = None
        self._source = "built-in"
        self._lock = threading.Lock()

    def _get(self) -> dict:
        if self._artifact is None:
            with self._lock:
                if self._artifact is None:
                    saved = model_store.load()
                    if saved is not None:
                        self._artifact, self._source = saved, "trained"
                    else:
                        self._artifact, self._source = training.train_builtin(), "built-in"
        return self._artifact

    def predict(self, text: str, embedding: list[float] | None = None) -> tuple[str, str, float]:
        """Returns (category, priority, confidence). Pass `embedding` to avoid embedding the text twice."""
        artifact = self._get()
        vector = embedding if embedding is not None else training._default_embed([text])[0]
        return training.predict_vectors(artifact, np.array([vector]))[0]

    def reload(self) -> None:
        """Drop the in-memory model so the next prediction picks up a newly saved one."""
        with self._lock:
            self._artifact = None

    def info(self) -> dict:
        artifact = self._get()
        metrics = model_store.load_metrics() if self._source == "trained" else None
        return {
            "source": self._source,
            "trained_at": artifact["trained_at"],
            "sources": artifact["sources"],
            "benchmark": metrics["benchmark"] if metrics else None,
        }


classifier = TicketClassifier()
