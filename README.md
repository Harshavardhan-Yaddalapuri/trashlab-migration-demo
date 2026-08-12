# TrashLab Migration Cockpit

Production-grade migration cockpit for waste-management data. An agent fleet
ingests, normalizes, dedupes, maps, validates, and reviews legacy data before
commit. Deterministic rules own every decision; LLM judgment is used only where
it earns its keep.

## Stack

- Next.js App Router + TypeScript strict + React 18 + Tailwind v4 + Zustand
- LangGraph (TypeScript SDK) for orchestration with checkpointing and replay
- LangSmith for tracing and eval
- Postgres (Neon/Supabase free tier) + Drizzle ORM
- BullMQ for async workers
- Vitest (unit) + Playwright (E2E)
- Deploy: Vercel free tier, server-side keys only

## Getting started

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL, optional LangSmith keys
npm run dev                  # http://localhost:3000
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (type-checks) |
| `npm run start` | Serve production build |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright E2E |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Seed demo dataset |

## Verify

```bash
npm run build && npm run test
```

## Docs

- `docs/Architecture.md` - system map
- `docs/Constraints.md` - what AI and code must never touch
- `docs/Decisions.md` - why decisions were made
- `docs/Flow.md` - execution trace
