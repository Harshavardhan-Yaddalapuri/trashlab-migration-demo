# Decisions

Why decisions were made, including the ones that didn't survive contact with
real data. New decisions append here.

## ADR-001: LangGraph over a custom orchestrator

A hand-rolled state machine would work, but LangGraph gives checkpointing,
replay, and typed graph semantics for free. Not using it would mean
reinventing a worse version of it.

## ADR-002: Drizzle over Prisma

Drizzle is lighter, SQL-first, and ships typed schema directly from
TypeScript. Prisma's generator adds a build step and a heavier runtime. Both
are reasonable choices; Drizzle keeps the deploy surface smaller on Vercel.

## ADR-003: No message queue

BullMQ was an early candidate for running the pipeline as a background job.
It was never wired up — a single migration job's pipeline run plus
persistence fits comfortably in one serverless function invocation using
Next.js's `after()` API (run the work after the HTTP response is sent, same
invocation, no separate worker infrastructure). A real queue would matter at
multi-tenant, many-concurrent-jobs scale; it wasn't needed for what this
actually does today.

## ADR-004: Deterministic core, judgment-only LLM use

Dates, dedup, and service-code mapping are pure rule-based code, not LLM
calls — the pipeline produces the same output for the same input every time,
which matters when the data involves customer records and pricing. LLM
judgment, where it's used at all, is reserved for genuinely ambiguous
classification and plain-language explanation, not decisions with a single
correct answer.

## ADR-005: Money as integer cents

Floats corrupt financial data over repeated operations. All money is integer
cents (USD) through a single parse/format module (`src/lib/money.ts`).

## ADR-006: Deterministic sample dataset, real server-side pipeline

The 150k-record sample dataset is generated from a seeded RNG
(`src/data/generate.ts`) so it's reproducible — same seed, same data, every
run. That part hasn't changed. What did change: the pipeline used to be a
frontend simulation running against in-browser generated data with hardcoded
report numbers. It's now a real server-side pipeline that processes whatever
file is actually uploaded (the sample dataset or a real export), persists
real output to Postgres, and computes every report number from that output.

## ADR-007: Onboarding workspace over pipeline cockpit

The first version of the UI showed pipeline internals: stage names, raw
exception type codes, a confidence histogram. Clicking through it didn't
communicate value, even to the person who built it — it read as "watch a
pipeline run," not "see what migrating actually gets you." It was rebuilt
around a different question: what does someone actually want to see when
they move their data into a new system? The answer is their data, alive in
the new system — so the destination is a working preview of the real app
(Customers, Agreements) populated with the hauler's own records, with any
issues surfaced as plain-language annotations in place, not a separate
report page.

## ADR-008: Real error states, not fallback data

An earlier design fell back to scripted data whenever the API was
unreachable, so a demo click-through would never look broken. That's wrong
for anything presented as real software: a careful technical reviewer who
kills the network mid-session and sees numbers that don't change reads that
as dishonest, not resilient. Failure states now show a real error and a
retry action.

## ADR-009: Postgres `COPY`, not batched `INSERT`

At 150k-record scale, persistence is on the order of 200,000 rows across
several tables. Parameterized batch `INSERT`s (even chunked and pipelined)
were roughly 5-10x slower than streaming the same data through Postgres's
`COPY` protocol, and the difference was the actual blocker to finishing a
full run inside one serverless function's time budget.

## ADR-010: Persist tables sequentially, not concurrently

The first `COPY`-based implementation ran all tables' writes concurrently
(one connection each, `Promise.all`), on the theory that independent tables
with no foreign-key relationship to each other should parallelize cleanly.
In practice, four concurrent `COPY` streams starting immediately after the
pipeline's CPU-heavy compute phase reliably stalled — even though a
standalone benchmark showed a single `COPY` of the same data moving in about
a second. Running the same four writes one after another fixed it outright.
Lesson: a benchmark that isolates one variable can miss contention that only
shows up under the real sequence of work; sequential was the simple fix once
concurrency was confirmed as the actual cause, not the first plausible
theory (network bandwidth, then `after()`'s runway, both of which were
tested and ruled out first).

## ADR-011: Don't persist raw/normalized records per row

Two of the pipeline's intermediate outputs (raw records, normalized records)
were originally written to Postgres one row per record — at full scale,
roughly half the total write volume. Nothing in the product ever queries
either table; the workspace UI and the outcome report only ever read
resolved entities, mapping proposals, and exceptions. Persisting them was
pure cost with no consumer, and it was part of what made even `COPY`-based
persistence too slow to finish in one invocation. They're now kept in memory
during a run and never written to Postgres; the uploaded file in Blob
storage is the durable record if raw/normalized data is ever needed again,
and since the pipeline is deterministic, recomputing it from that file is
exact.
