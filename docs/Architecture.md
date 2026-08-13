# Architecture

System map for the TrashLab Migration Cockpit.

## Layers

1. **UI (Next.js App Router)**
   - `src/app` — routes: `/` (landing), `/migrate` (connect a system, upload
     files), `/migrate/processing` (brief status while the pipeline runs),
     `/workspace` (the destination: outcome banner + entity review)
   - `src/components/demo` — landing page, file upload/connect flow
   - `src/components/workspace` — config-driven entity views: `entity-config.ts`
     declares one `EntityConfig` per business object (Customers, Agreements),
     and `entity-list-view.tsx` / `entity-detail-panel.tsx` / `annotation-card.tsx`
     render any config generically. Adding another entity type is a new
     config, not a new screen.
   - `src/components/{cockpit,exceptions,report}` — small shared UI pieces
     (header, exception card, money formatting) used by the workspace views
   - `src/features` — one folder per pipeline stage (intake, normalize,
     resolve, map, validate, review, commit, training, report); this is
     where report/CSV computation and training-packet logic lives, separate
     from the pipeline's own agent code

2. **Pipeline (LangGraph)**
   - `src/pipeline/graph.ts` — the `StateGraph` orchestrator: intake →
     normalize → resolve → map → validate → review → commit, with an
     in-memory checkpointer for replay within a single run
   - `src/pipeline/agents` — one typed agent per stage, each implementing a
     contract from `contracts.ts`
   - `src/pipeline/rules` — pure deterministic functions: date normalization,
     phone/E.164, container ID canonicalization, company-name normalization,
     blocking-key dedup, service-code mapping (a versioned rule table)
   - `src/pipeline/eval` — golden set and metrics; the eval gate is meant to
     block regressions in agent/rule changes

3. **Data**
   - `src/data/generate.ts` — deterministic seeded RNG that produces the
     150k-record sample dataset (same seed, same data, every time)
   - `sample-data/` — the 4 legacy source files exported from that generator,
     used for the live demo and for local testing

4. **Server**
   - `src/server/db/schema.ts` — Drizzle schema. `migration_jobs`,
     `source_files`, `resolved_entities`, `proposals`, `exceptions`,
     `audit_events`, `tenants`
   - `src/server/db/client.ts` — Drizzle + `pg` `Pool`, pointed at Neon's
     pooled connection endpoint (required — see "Why the pooled endpoint" in
     Decisions.md)
   - `src/server/pipeline-runner.ts` — runs the LangGraph pipeline for a job
     and persists its output via `COPY`, one table at a time
   - `src/server/report-data.ts` — computes the outcome-banner numbers from
     what's actually persisted (no hardcoded metrics)
   - `src/app/api` — Next.js route handlers, contract-first types in
     `src/server/api/contracts.ts`

## Data flow

Uploaded file (Blob storage) → pipeline compute (in-memory: raw → normalized
→ resolved entities → mapping proposals → validated → exceptions) → persist
only the pipeline's *output* to Postgres (`resolved_entities`, `proposals`,
`exceptions`, `audit_events`) → workspace UI reads that output directly, no
intermediate cache.

Raw and normalized per-record rows are **not** persisted to Postgres — they
exist in memory during a run and are dropped once the pipeline finishes.
Nothing in the product reads them, and at full scale they were roughly half
the total write volume for zero benefit. The uploaded file in Blob storage
is the audit trail if that data is ever needed again; since the pipeline is
deterministic, recomputing it is exact, not an approximation.

## Guardrail boundary

Deterministic, reversible work (parsing, normalizing, deduping, mapping) is
fully automated. The commit step and any exception resolution require a
human action through the UI — the pipeline itself never silently commits
low-confidence decisions.
