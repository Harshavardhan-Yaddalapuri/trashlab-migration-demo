# TrashLab Migration Cockpit

See `README.md` for what this project is and why it exists.

## Quick facts

- Stack: Next.js 15 (App Router) + TypeScript strict + LangGraph + LangSmith + Drizzle/Postgres + Zustand
- Tests: `npx vitest run`. Build: `npm run build`. Lint: 0 errors.
- Deploy: Vercel, auto-deploy on push to `main`. Live: https://trashlab-migration-demo.vercel.app
- Sample data: `scripts/export-source-files.ts` writes the 4 legacy source files (150k rows) to `sample-data/`
- Env: `.env.local` (`DATABASE_URL` = Neon, pooled endpoint; `BLOB_READ_WRITE_TOKEN`; optional `LANGSMITH_API_KEY`). Never commit secrets.

## Rules of the repo

- Money is always integer cents (`src/lib/money.ts`), never a float.
- The pipeline's rule-based stages (dates, dedup, service-code mapping) are deterministic and seeded. No `Math.random`, no LLM calls in the decision path.
- No em-dashes in user-facing text.
- The customer-facing UI speaks in outcomes, not internal pipeline mechanics (no agent names, no raw exception type codes, no stage names in customer-visible copy).
- On API failure, show a real error/retry state. Never fall back to fabricated data.
- `raw_records`/`normalized_records` are not persisted per-row in Postgres (see `src/server/pipeline-runner.ts` and `src/server/report-data.ts` for why) — the uploaded source file in Blob storage is the audit trail instead.
- Postgres bulk writes use `COPY`, run sequentially per table, not parallel `Promise.all` — see `src/server/pipeline-runner.ts`'s header comment for why concurrent COPY streams were slower in practice.
- One change at a time. Verify after each: `npx vitest run` + `npm run build`.
