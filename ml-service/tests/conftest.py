import pytest

import classifier as serving
import training

_cache: dict[str, list[float]] = {}


def _cached_embed(texts: list[str]) -> list[list[float]]:
    """Real MiniLM embeddings, memoised for the whole test session so retraining tests stay fast."""
    missing = [t for t in dict.fromkeys(texts) if t not in _cache]
    if missing:
        from embeddings import embed_many

        for text, vector in zip(missing, embed_many(missing)):
            _cache[text] = vector
    return [_cache[t] for t in texts]


@pytest.fixture(autouse=True)
def isolated_model_dir(tmp_path, monkeypatch):
    """Never read or write a developer's real models/ folder, and start every test from the built-in model."""
    monkeypatch.setenv("MODEL_DIR", str(tmp_path / "models"))
    monkeypatch.setattr(training, "_default_embed", _cached_embed)
    serving.classifier.reload()
    yield
    serving.classifier.reload()
