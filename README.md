# TrashLab Migration Cockpit

Production-grade migration cockpit for waste-management data. An agent fleet
ingests, normalizes, dedupes, maps, validates, and reviews legacy data before
commit. Deterministic rules own every decision; LLM judgment is used only where
it earns its keep.

Built for the TrashLab Product Engineer role: proves the full loop from
customer pain to shipped product, using the exact stack TrashLab runs
(TypeScript, Node, Postgres) and the exact problem their FAQ says takes the
longest: clean data migration for larger fleets.

## Live demo

- **URL:** (deploy pending — see below)
- **Repo:** https://github.com/Harshavardhan-Yaddalapuri/trashlab-migration-demo

### 90-second demo flow

1. **Problem** — TrashLab's own FAQ quote on screen: "Larger fleets with
   multiple yards, recurring routes, and existing software take longer because
   clean data migration, training, and rollout matter more than going fast."
   The thesis: with an agent fleet you get clean migration AND speed.
2. **Drop the files** — 4 legacy sources (RoutePro CSV, QuickBooks export,
   transfer-station spreadsheets, paper-era exports) simulated as file drops.
   The fleet wakes up and agents stream decisions.
3. **Live sample** — 500 rows animated, then the full 150k batch with per-agent
   throughput.
4. **Exception review** — 8 featured issues with evidence and suggested fixes,
   approved live in seconds; 1,493 more grouped by type with bulk-resolve.
5. **Report** — 2 days to go-live, 99.2% auto-mapped, 0 silent errors,
   per-role training packets ready, full audit trail.

The dataset is 150,000 records generated deterministically in-browser from a
seeded RNG. Same seed = same data every visit. No API keys needed to run the
demo; the pipeline core is deterministic by design.

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
