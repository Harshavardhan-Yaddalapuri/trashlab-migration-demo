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
   - `src/features` — one folder per surface that isn't pipeline-agent code:
     intake, normalize, resolve, map, validate, review, and report (the
     outcome-banner computation). A `commit`/`rollback`/`training` batch
     subsystem lived here earlier but was removed (see `docs/Decisions.md`,
     ADR-012) — it had no client caller and depended on a stale in-memory
     store disconnected from the real Postgres-backed jobs

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
     `audit_events`, `tenants`, `rate_limit_events`
   - `src/server/db/client.ts` — Drizzle + `pg` `Pool`, pointed at Neon's
     pooled connection endpoint (required — see ADR entry in
     `docs/Decisions.md`). Both `db` and `pool` are lazy proxies: the real
     `Pool` (and its `DATABASE_URL` validation) is only constructed on
     first actual query, not at module import time (ADR-015) — importing
     the module, which Next.js's build does for every route to read its
     metadata, must not itself require a live database
   - `src/server/pipeline-runner.ts` — runs the LangGraph pipeline for a job
     and persists its output via `COPY`, one table at a time
   - `src/server/report-data.ts` — computes the outcome-banner numbers from
     what's actually persisted (no hardcoded metrics)
   - `src/server/rate-limit.ts` — Postgres-backed fixed-window IP rate
     limiting (no Redis/new infra), used on job creation
   - `src/server/api/contracts.ts` — contract-first API types, plus
     `withApiErrorHandling`: every route wraps its logic in this so a DB
     failure returns the app's own consistent JSON error shape instead of
     Next's generic framework error page
   - `src/app/api` — Next.js route handlers
   - `next.config.ts` — security headers (CSP, X-Frame-Options, HSTS,
     Permissions-Policy); the CSP allowlist is scoped to exactly what the
     app calls (Vercel Blob's token exchange and storage domain, Google
     Fonts) and was verified against a real production build plus a full
     upload flow before shipping, not assumed
   - `.github/workflows/ci.yml` — lint, typecheck, test, build on every
     push/PR to `main`

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
fully automated inside the pipeline's own `commit` node (in `graph.ts`) --
it runs without a human in the loop, but its outcome is a business-rule
verdict, not a silent success: if review turns up any `critical`-severity
exception, the job's status becomes `failed` (needs a human before this
migration can be considered done), otherwise `completed`. Either way the
data is fully persisted. The actual human action lives in the workspace UI:
reviewing and approving/rejecting individual exceptions
(`/api/jobs/[jobId]/exceptions/[exceptionId]/approve` and `/reject`) — the
pipeline never silently resolves a low-confidence decision on its own.

## Abuse protection

Job creation (`POST /api/v1/migration-jobs`) is IP rate limited (10/hour,
Postgres-backed, see `src/server/rate-limit.ts`) since each call triggers a
real pipeline run plus Postgres writes, and the `sourceFiles` array is
capped at 10 entries. Neither requires new infrastructure -- both reuse the
existing DB connection.
