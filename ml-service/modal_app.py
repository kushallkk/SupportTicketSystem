"""
Runs the ML service on Modal (modal.com): the same FastAPI app as `main.py`, hosted in an always-on container.

    pip install modal
    modal setup                                   # one-time browser login
    modal secret create resolveiq-ml DATABASE_URL=... ML_API_KEY=... ML_ADMIN_TOKEN=...
    modal deploy modal_app.py                     # prints the public https URL

Modal's free Starter plan gives $30 of compute credit per month. One warm container with 2 GiB of RAM costs
roughly $20 of that, which is why `min_containers=1`: the first ticket after a quiet spell must not wait for a
cold start. Lower `min_containers` to 0 to scale to zero (cheaper, but the first request then waits ~20-30 s).
"""
from pathlib import Path

import modal

HERE = Path(__file__).parent

image = (
    modal.Image.debian_slim(python_version="3.12")
    # CPU-only torch first: the default wheel bundles CUDA and is several GB larger.
    .pip_install("torch", index_url="https://download.pytorch.org/whl/cpu")
    .pip_install_from_requirements(str(HERE / "requirements.txt"))
    # Bake the embedding model into the image so a container start doesn't download it.
    .run_commands("python -c \"from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')\"")
    .env({"MODEL_DIR": "/tmp/models"})
    .add_local_dir(
        HERE,
        remote_path="/root/app",
        ignore=["venv", "models", ".cache", "tests", "__pycache__", "*.pyc", ".env", "Dockerfile", "*.sh"],
    )
)

app = modal.App("resolveiq-ml", image=image)


@app.function(
    secrets=[modal.Secret.from_name("resolveiq-ml")],  # DATABASE_URL, ML_API_KEY, ML_ADMIN_TOKEN
    cpu=0.5,
    memory=2048,
    min_containers=1,
    scaledown_window=600,
    timeout=300,  # retraining embeds the benchmark and can take a while
)
@modal.concurrent(max_inputs=8)
@modal.asgi_app()
def web():
    import sys

    sys.path.insert(0, "/root/app")
    from main import app as fastapi_app

    return fastapi_app
