# ResolveIQ

AI-powered support ticket system. Two services:

- `web/` - Next.js 16 (App Router), React 19, TypeScript, Tailwind v4, shadcn/ui on **Base UI**, Prisma + Postgres, NextAuth v5, Socket.io (`server.ts`).
- `ml-service/` - FastAPI. Sentence embeddings (all-MiniLM-L6-v2) + logistic regression for category/priority, cosine duplicate detection, weighted agent routing.

Read `web/AGENTS.md` before writing Next.js code (this Next version differs from older docs).

## Commands

```bash
cd web && npm run dev            # custom server (Next + Socket.io) on :3000
cd web && npm run typecheck && npm test
cd web && npm run test:integration   # needs web/.env.test (disposable Postgres)
cd web && npm run test:e2e           # Playwright; builds into .next-e2e
cd ml-service && python -m pytest -q
```

## UI & UX Guidelines

- **Primary UI stack:** Tailwind CSS + shadcn/ui. Reach for an existing shadcn component before writing custom markup; add missing ones with `npx shadcn@latest add <name>`.
- **Layout:** Always enforce a modern 3-column SaaS viewport: **Sidebar navigation** (left), **center ticket feed**, **right-side contextual detail panel**. Ticket lists and ticket pages must both follow it. On narrow screens the detail panel stacks below or opens in a sheet; the sidebar becomes a drawer.
- **Borders:** Avoid heavy solid borders. Separate regions with white space and subtle background shifts (e.g. `bg-muted/40`), soft rings (`ring-1 ring-foreground/5`) and gentle shadows. No thick `border-2`, no dark outlines.
- **Interactivity:** All actions must use shadcn dropdown menus, the command palette (⌘K), or dialogs with slick animations. No bare `window.confirm`/`alert`, no raw `<select>`.

### Implementation notes

- shadcn here is the **Base UI** flavour: compose with the `render` prop (`<Button render={<Link href="..." />}>`), not `asChild`. Selects need `items` so labels render instead of raw values.
- Status/priority colours live in `web/src/lib/ticket-display.ts`; badges in `web/src/components/ticket-badges.tsx`. Keep them the single source.
- Browser tests (`web/tests/e2e`) rely on accessible names and `data-testid`s. Change markup freely, but keep roles/names/test ids or update the tests in the same change.
- Support light and dark themes; test both. Colours come from the CSS variables in `web/src/app/globals.css`.
