# ResolveIQ

AI-powered support ticket system with three role-based dashboards (User, Agent, Admin) and three AI-driven differentiators:

1. **Auto-classification & routing** — every new ticket is classified (category + priority) and routed to the best-fit agent automatically, factoring in workload and category track record.
2. **Smart load-balancing** — routing isn't round-robin; it's a weighted score of an agent's current open tickets, average resolution time, and accuracy for that category.
3. **Duplicate detection** — new tickets are embedded and compared against resolved tickets via cosine similarity. A close match (≥80%) is surfaced to the user and agent, with an option to self-resolve instead of waiting on a fresh ticket.

## Stack

- **Web** (`/web`): Next.js 16 (App Router) + TypeScript + Tailwind + shadcn/ui (Base UI primitives) + Framer Motion + Recharts. NextAuth v5 (credentials) for role-based auth. Prisma + Postgres (Neon). Socket.io for realtime ticket/comment updates over a custom Node server.
- **ML service** (`/ml-service`): FastAPI + scikit-learn (TF-IDF + Logistic Regression) for classification, `sentence-transformers` (all-MiniLM-L6-v2) for embeddings, and a plain weighted-scoring function (not ML) for load-balancing.

Ticket creation still succeeds even if the ML service is down — classification/routing/duplicate-detection calls fail soft.

## Prerequisites

- Node.js 20+
- Python 3.11+
- A free Postgres database — [neon.tech](https://neon.tech)

## Setup

### 1. Web app

```bash
cd web
npm install
cp .env.example .env   # fill in DATABASE_URL, NEXTAUTH_SECRET
npx prisma migrate deploy
npm run dev
```

Runs at `http://localhost:3000`.

### 2. ML service

```bash
cd ml-service
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
cp .env.example .env         # same DATABASE_URL as /web
uvicorn main:app --reload --port 8000
```

Runs at `http://localhost:8000`. First `/classify` call downloads the MiniLM embedding model (~90MB) and caches it locally.

### 3. Seed demo data (optional but recommended)

With both services running:

```bash
cd web
npm run seed
```

Creates an admin, 5 agents, 15 users, and 130+ tickets across categories/statuses — including real AI classifications and embeddings if the ML service is reachable. Prints the demo login (`admin@resolveiq.dev` / `password123`, all seeded accounts share that password).

## Attachments

Customers, agents and admins can attach images, PDF, TXT, LOG and CSV files (5 MB each, 5 per upload, 20 per ticket) to a ticket or to a comment. Files on an agent's internal note are hidden from the customer.

Uploads are validated by their real content, not just the filename (SVG/HTML are refused), stored under a random key, and served through an authorized route with `nosniff` and a sandboxing CSP. Locally they live in `web/.uploads/` (gitignored). The storage backend sits behind a small interface in `web/src/lib/storage`.

## Tests

```bash
# ML service
cd ml-service && pip install -r requirements-dev.txt && python -m pytest

# Web: unit tests (no database needed)
cd web && npm test

# Web: integration + browser (E2E) tests
```

Integration and E2E tests **wipe every table** in the database they run against, so they use a separate throwaway Postgres (a free second Neon project works). Put its connection string in `web/.env.test` (gitignored) as `DATABASE_URL="..."`, or set `TEST_DATABASE_URL`. Every entry point refuses to run if that database is the same host as the one in `web/.env`.

```bash
cd web
npm run test:integration   # API routes against the real test database
npx playwright install chromium   # once
npm run test:e2e           # production build + Chromium; uses a stub for the ML service
```

CI (`.github/workflows/ci.yml`) always runs typecheck, unit tests and the ML tests; it runs the database-backed suites when a `TEST_DATABASE_URL` repository secret exists.

## Project structure

```
/web           Next.js app (frontend + API routes + Prisma schema)
/ml-service    FastAPI microservice (classification, embeddings, routing)
```

## Notes

- Admin accounts aren't self-serve — sign up as a User or Agent, then create an admin directly (`npx tsx prisma/create-admin.ts` in `/web`, or promote a user's `role` in the DB).
- No deployment is required for local dev/demo — both services run on localhost. The frontend alone could be deployed to Vercel later; skip deploying the Python service to a free tier that cold-starts.
