"""Sentence embeddings for duplicate ticket detection."""

from sentence_transformers import SentenceTransformer

_model: SentenceTransformer | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed(text: str) -> list[float]:
    model = get_model()
    vector = model.encode(text, normalize_embeddings=True)
    return vector.tolist()


def embed_many(texts: list[str]) -> list[list[float]]:
    """Batch version used when training; same model and normalization as `embed`."""
    model = get_model()
    vectors = model.encode(texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
    return vectors.tolist()
