# Deploying ResolveIQ (all free tiers)

```
 Browser ──> Vercel (Next.js web app, root dir `web/`) ──> Neon Postgres
                │  ├─ Vercel Blob (private)  : ticket attachments
                │  ├─ Pusher Channels        : live updates
                │  └─ x-api-key ─────────────> Hugging Face Space (FastAPI ML service)
```

Why these: Vercel cannot hold WebSockets open (so Pusher replaces Socket.io) and has no persistent disk (so
Vercel Blob replaces local uploads). The ML service needs an always-on container with ~2 GB RAM for the embedding
model, and a free Space gives 16 GB and only sleeps after ~48 h idle.

Locally nothing changes: with none of the variables below set, the app still uses Socket.io and local disk.

## 0. Secrets you generate yourself

Run these and keep the output somewhere private (a password manager, not a chat):

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 24      # ML_API_KEY
openssl rand -hex 24      # ML_ADMIN_TOKEN
openssl rand -hex 8       # AGENT_SIGNUP_CODE (the invite code you give real agents)
```

## 1. Neon: rotate the password first

The current database password has been pasted into chat and sits in local files, so treat it as exposed.

1. console.neon.tech -> your project -> **Roles** -> reset the password of the role you use.
2. Copy both strings: the **pooled** one (host contains `-pooler`) for the app, and the **direct** one for migrations.
3. Update your local `web/.env` and `ml-service/.env` with the new values.

## 2. Hugging Face Space (ML service)

1. huggingface.co -> **New Space** -> SDK **Docker** -> template **Blank** -> hardware **CPU basic (free)**.
2. Space **Settings -> Variables and secrets -> New secret**, add: `DATABASE_URL` (pooled), `ML_API_KEY`, `ML_ADMIN_TOKEN`.
3. Create a **write** access token (huggingface.co/settings/tokens).
4. From the repo root, after committing:

   ```bash
   ml-service/deploy-to-space.sh https://huggingface.co/spaces/<you>/<space-name>
   ```

   Username = your HF username, password = the token. The first build takes ~5-10 minutes.
5. When it says "Running", open `https://<you>-<space-name>.hf.space/health` -> `{"status":"ok"}`.

Notes: the Space URL is public, but every endpoint except `/health` demands `x-api-key`. A retrained model is saved
on the Space's disk, which is wiped when the Space restarts, so after a restart it serves the built-in model until an
admin presses *Retrain* again.

## 3. Pusher (live updates)

1. pusher.com -> **Channels** -> **Create app** -> cluster nearest your users (e.g. `ap2` Mumbai) -> front end: React, back end: Node.js.
2. Open **App Keys**: note `app_id`, `key`, `secret`, `cluster`.
3. **App Settings**: leave "Enable client events" off. Private channels are authorised by `/api/realtime/auth`.

## 4. Vercel (web app)

1. vercel.com -> **Add New -> Project** -> import the GitHub repo.
2. **Root Directory: `web`**. Framework: Next.js (auto). Leave build/install commands as default.
3. **Environment Variables** (Production):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** string |
   | `AUTH_SECRET` | from step 0 |
   | `ML_SERVICE_URL` | `https://<you>-<space-name>.hf.space` |
   | `ML_API_KEY` | same as in the Space |
   | `ML_ADMIN_TOKEN` | same as in the Space |
   | `STORAGE_DRIVER` | `blob` |
   | `PUSHER_APP_ID` / `PUSHER_KEY` / `PUSHER_SECRET` / `PUSHER_CLUSTER` | from Pusher |
   | `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | same key and cluster |
   | `AGENT_SIGNUP_CODE` | from step 0 |

   `NEXT_PUBLIC_*` values are baked in at build time, so set them **before** the first deploy (or redeploy after).
4. **Storage** tab -> **Create** -> **Blob** -> access **Private** -> connect to this project. This adds
   `BLOB_READ_WRITE_TOKEN` automatically.
5. **Deploy.**

## 5. Database and accounts (from your laptop)

Migrations use the **direct** Neon host, because the pooler leaks Prisma's advisory lock:

```bash
cd web
DATABASE_URL="<direct string>" npx prisma migrate deploy
```

The demo seed accounts all share well-known passwords (`password123`, `admin1234`). Before sharing the link,
change them: sign in as admin and use a strong password, or run `create-admin` with a new one, and either delete
the demo customers/agents or give them new passwords.

## 6. Smoke test

- [ ] `/login` loads; sign in as admin
- [ ] Raise a ticket as a customer: AI category, priority and an assigned agent appear within a few seconds
- [ ] Agent window shows the ticket live (no refresh)
- [ ] Attach a PNG and a PDF; download them; a different customer gets a 404 for the same link
- [ ] Admin -> Analytics -> *Retrain from corrections* responds
- [ ] Signing up as an agent without the invite code is refused

## Known limits on the free tiers

- The first ticket after the Space has slept may skip AI (the web app waits 5 s, a cold Space needs 1-2 minutes).
  The ticket is still created; open the Space URL once before a demo to warm it up.
- Attachments are capped at 4 MB (Vercel's request-body limit) and uploaded one file per request.
- Vercel Hobby is for non-commercial use, which covers a college project.
