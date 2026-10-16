# ResolveIQ ML service

FastAPI service behind the ResolveIQ support desk: ticket classification (sentence embeddings + logistic
regression), duplicate detection, and weighted agent routing.

- Local: `uvicorn main:app --port 8000`
- Deployed: `modal deploy modal_app.py` (see `modal_app.py` and `../DEPLOYMENT.md`)

Secrets (never committed): `DATABASE_URL`, `ML_API_KEY`, `ML_ADMIN_TOKEN`. When `ML_API_KEY` is set, every
endpoint except `/health` requires the `x-api-key` header.
