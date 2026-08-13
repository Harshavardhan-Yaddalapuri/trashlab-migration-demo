# TrashLab Migration Cockpit

A working prototype of an onboarding tool for moving a waste-hauling company's data
into TrashLab: a hauler connects an existing system, a real pipeline cleans and
resolves the data, and the result lands in a live preview of TrashLab populated
with that hauler's actual customers and agreements.

**Live:** https://trashlab-migration-demo.vercel.app

## The problem this explores

TrashLab's own FAQ notes that larger fleets take longer to onboard "because clean
data migration, training, and rollout matter more than going fast." That's usually
treated as a tradeoff: migrate carefully and slowly, or quickly and messily.

This project explores whether that's actually a false choice — whether a
deterministic, well-tested pipeline can get a hauler's legacy data clean *and*
fast, instead of picking one.

## What it does

1. **Connect** — drop a legacy export (RoutePro CSV, QuickBooks export,
   transfer-station spreadsheet, or an old paper-era format). Files upload
   directly to Blob storage rather than through the API, so real-sized
   exports (up to 50MB) work without hitting a serverless request-body
   limit.
2. **Process** — a real pipeline runs server-side: intake → normalize →
   resolve duplicates → map to TrashLab's service model → validate → flag
   exceptions → commit. Deterministic and seeded throughout — dates, dedup,
   and service-code mapping are rule-based, not LLM judgment calls, so the
   same input always produces the same output.
3. **Review** — the hauler's data lands in a working preview of the actual
   app: real Customers and Agreements, populated from what was just
   uploaded. Anything the pipeline couldn't resolve with confidence shows up
   inline as a plain-language annotation (not a raw error code) with
   evidence and a suggested fix, approve/reject in place.

A reference run against the full 150,000-record sample dataset resolves
144,235 customer/agreement entities, produces 18,000 service-mapping
proposals, and raises 36,982 exceptions for review — all real numbers from
an actual run, not fixtures.

## Try it

Visit the live URL above, drop the sample files from `sample-data/` (or your
own CSV/TSV export in a similar shape), and watch it run end to end.

## Architecture

See `docs/Architecture.md` for the full system map and `docs/Decisions.md`
for why key choices were made. Short version:

- **Pipeline** (`src/pipeline`): a LangGraph state machine, one typed agent
  per stage, pure deterministic rule functions for dates/phones/dedup/service
  codes, an eval layer with a golden set that blocks regressions.
- **Persistence** (`src/server`): Postgres via Drizzle, bulk-loaded with
  `COPY` (not row-by-row `INSERT`) since a full run touches on the order of
  200,000 rows. Only the pipeline's *output* (resolved entities, mapping
  proposals, exceptions, audit log) is persisted per-row — the original
  uploaded file in Blob storage is the source-of-truth audit trail, since
  the pipeline is deterministic and its intermediate steps are reproducible
  from that file on demand.
- **UI** (`src/components/workspace`): a config-driven entity view — one
  `EntityConfig` per business object (Customers, Agreements today) drives a
  shared list/detail/annotation component, so adding another entity type
  (Sites, Containers, Routes, Tickets) is a config, not a new screen.

## Stack

- Next.js 15 (App Router) + TypeScript strict + Tailwind v4 + Zustand
- LangGraph for pipeline orchestration
- Postgres (Neon) + Drizzle ORM
- Vercel Blob for file uploads, Vercel for hosting
- Vitest for tests, Playwright for end-to-end verification

## Running locally

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL and BLOB_READ_WRITE_TOKEN
npm run dev                  # http://localhost:3000
```

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (type-checks) |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run db:generate` / `db:migrate` | Drizzle migrations |

## Current scope and honest limitations

- **Two entity types have a full review UI** (Customers, Agreements). Sites,
  Containers, Routes, and Tickets flow through the pipeline but don't have a
  dedicated screen yet — the config pattern supports adding them without a
  rebuild.
- **Four known source formats.** The pipeline recognizes RoutePro CSV,
  QuickBooks exports, transfer-station spreadsheets, and one legacy
  fixed-width format. A source in a genuinely new shape wouldn't parse
  cleanly today.
- **Unrecognized fields survive but aren't surfaced.** If a source file has
  a column the pipeline doesn't know about, that data isn't dropped — it
  rides along in the record's stored fields — but there's no UI yet to show
  a reviewer "here's a field we didn't recognize" or let them map it to a
  target field. That's the most concrete next step.
- **One migration run at a time per job.** There's no multi-tenant queueing
  or scheduling; this is a single-job pipeline, not a background job system.

## Docs

- `docs/Architecture.md` — system map
- `docs/Decisions.md` — why key decisions were made, including the ones that
  didn't work on the first try
- `docs/Flow.md` — execution trace, happy path and real failure handling
- `docs/Constraints.md` — invariants the code and any AI-assisted change
  must not violate
