---
title: ResolveIQ ML Service
emoji: 🎯
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# ResolveIQ ML service

FastAPI service behind the ResolveIQ support desk: ticket classification (sentence embeddings + logistic
regression), duplicate detection, and weighted agent routing.

Secrets (set as Space secrets, never committed): `DATABASE_URL`, `ML_API_KEY`, `ML_ADMIN_TOKEN`.
Every endpoint except `/health` requires the `x-api-key` header.
