# Decisions

Why decisions were made. New decisions append here.

## ADR-001: LangGraph over a custom orchestrator

The earlier design leaned custom to keep the demo client-side and
dependency-free. That was the wrong frame: this is a production application.
LangGraph gives checkpointing, replay, and graph semantics for free, and it is
the framework a reviewer expects to see. The custom state machine would be
reinventing it worse.

## ADR-002: Drizzle over Prisma

Drizzle is lighter, SQL-first, and ships typed schema directly from
TypeScript. Prisma's generator adds a build step and a heavier runtime. Both
are acceptable; Drizzle keeps the deploy surface small on Vercel.

## ADR-003: BullMQ with Postgres fallback

Async workers need a queue. BullMQ is the standard choice and works with
Redis; the design documents Postgres LISTEN/NOTIFY as the zero-dependency
fallback for the demo tier.

## ADR-004: Deterministic core first

Rules (dates, dedup blocking, mapping) are deterministic code. The LLM only
handles judgment. This matches the operator's own blog: "When AI is attached
to an actual operating loop, it becomes valuable. When it is detached from the
workflow, it becomes noise."

## ADR-005: Money as integer cents

Floats corrupt financial data. All money is integer cents (USD) with a single
parse/format module.

## ADR-006: Seeded in-browser generation

150k records are generated deterministically from a seeded RNG, not shipped as
a 50MB JSON bundle. Same seed = same data every visit. The demo stays $0 and
fast.
