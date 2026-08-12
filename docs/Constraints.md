# Constraints

What AI and code must never touch in this project.

## Hard rules

1. **No secrets in client code.** API keys live server-side only, via
   environment variables. Never import `src/server/db/client.ts` from a client
   component.
2. **Money is integer cents, never float.** All monetary values use
   `src/lib/money.ts` (`Cents`). Parsing and formatting go through it.
3. **No `any`.** Strict TypeScript everywhere. Typed agent contracts in
   `src/pipeline/agents/contracts.ts` are the vocabulary.
4. **No magic numbers.** Configuration lives in `src/lib/config.ts`.
5. **Deterministic rules own deterministic decisions.** The LLM is never asked
   to normalize a date, dedupe a customer, or map a service code. LLM judgment
   is limited to classification, fuzzy suggestions, and training prose.
6. **Raw records are immutable.** `raw_records` is append-only with a hash.
   Never mutate ingested data in place.
7. **The audit log is append-only.** `audit_events` is history; it is never
   edited or deleted.
8. **No em-dashes in user-facing text.**
9. **Never operate on corrupted data.** Stop and escalate. The Replit incident
   (agent ran DROP DATABASE despite a freeze instruction) is why.
10. **Keyset pagination, never OFFSET** on large tables (150k+ records).

## Process rules

- One change at a time. Read every diff before finishing.
- BUILD -> TEST -> FIX. Never mark done with failing tests.
- Eval gate: any agent or rule change runs against the golden set; regression
  blocks merge.
