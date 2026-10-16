"""Saving and loading the trained classifier artifact (models/ is gitignored: it is produced locally)."""

import json
import os
import tempfile
from pathlib import Path

import joblib
import sklearn

FORMAT = 2
EMBEDDING_MODEL = "all-MiniLM-L6-v2"


def model_dir() -> Path:
    return Path(os.environ.get("MODEL_DIR", Path(__file__).parent / "models"))


def artifact_path() -> Path:
    return model_dir() / "classifier.joblib"


def metrics_path() -> Path:
    return model_dir() / "metrics.json"


def save(artifact: dict, metrics: dict) -> None:
    """Writes atomically so a crash mid-save can never leave a half-written model that fails to load."""
    directory = model_dir()
    directory.mkdir(parents=True, exist_ok=True)
    for target, writer in (
        (artifact_path(), lambda f: joblib.dump(artifact, f)),
        (metrics_path(), lambda f: f.write(json.dumps(metrics, indent=2).encode("utf-8"))),
    ):
        fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
        try:
            with os.fdopen(fd, "wb") as handle:
                writer(handle)
            os.replace(tmp, target)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise


def load() -> dict | None:
    """
    Returns the saved artifact, or None if there isn't a usable one (missing, wrong format, or built
    with a different scikit-learn/embedding model, in which case the service retrains from built-ins).

    Security note: joblib files are pickles, so this must only ever read files this service itself
    wrote into MODEL_DIR, never anything user-supplied.
    """
    path = artifact_path()
    if not path.exists():
        return None
    try:
        artifact = joblib.load(path)
    except Exception as error:  # corrupt or unreadable
        print(f"[model_store] ignoring unreadable model file: {error}")
        return None
    if (
        artifact.get("format") != FORMAT
        or artifact.get("sklearn_version") != sklearn.__version__
        or artifact.get("embedding_model") != EMBEDDING_MODEL
    ):
        print("[model_store] saved model is incompatible with this environment; ignoring it")
        return None
    return artifact


def load_metrics() -> dict | None:
    path = metrics_path()
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
