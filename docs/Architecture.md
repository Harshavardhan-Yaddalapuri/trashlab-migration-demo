# Architecture

System map for the TrashLab Migration Cockpit.

## Layers

1. **Cockpit (Next.js App Router)**
   - `src/app` - routes and shell
   - `src/components` - cockpit, exceptions, report, ui primitives
   - `src/features` - one folder per pipeline stage (intake, normalize,
     resolve, map, validate, review, training)
   - Zustand store for live cockpit state

2. **Pipeline (LangGraph)**
   - `src/pipeline/graph.ts` - StateGraph orchestrator with checkpointing
     (MemorySaver) and replay
   - `src/pipeline/agents` - one typed agent per stage, each implementing a
     contract from `contracts.ts`
   - `src/pipeline/rules` - pure deterministic functions (dates, ids, phones,
     dedup keys, code mapping)
   - `src/pipeline/eval` - golden set and metrics; the eval gate blocks
     regressions

3. **Data**
   - `src/data/generate.ts` - deterministic seeded RNG; same seed = same data
   - `src/data/seed.ts` - seeds Postgres via Drizzle

4. **Server**
   - `src/server/db` - Drizzle schema and Postgres client (server-side only)
   - `src/server/api` - contract-first API types
   - `src/app/api` - Next.js route handlers

## Data flow

Source files -> raw records (immutable, hashed) -> normalized records ->
resolved entities (blocking-key dedup, O(n)) -> mapping proposals ->
validation -> exception queue (human review) -> commit.

## Guardrail boundary

Reversible and deterministic work is automated. Irreversible work (DB writes,
schema changes, commits) requires a human gate. Migration agents never operate
on corrupted data; they stop and escalate.
