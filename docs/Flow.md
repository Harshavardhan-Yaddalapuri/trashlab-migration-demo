# Flow

Execution trace for a migration job, as actually implemented.

## Happy path

1. User drops a legacy source file at `/migrate` (RoutePro CSV, QuickBooks
   export, transfer-station spreadsheet, or a legacy fixed-width export).
   The browser uploads it directly to Vercel Blob storage (not through the
   API route), which is what makes real-sized exports work — a serverless
   function's request body limit would otherwise cap uploads at a few
   megabytes.
2. `POST /api/v1/migration-jobs` with the resulting Blob URLs returns a
   `jobId` immediately (`201`). The pipeline run is scheduled to happen
   after that response is sent, in the same function invocation.
3. The LangGraph `StateGraph` runs: intake → normalize → resolve → map →
   validate → review → commit, streaming progress into the job's row after
   every stage.
4. `/migrate/processing` polls the job and shows outcome-level status
   ("Matching your customers...", not stage names) derived from that
   progress.
5. Once the pipeline's compute finishes, its output (resolved entities,
   mapping proposals, exceptions, audit events) is persisted to Postgres via
   `COPY`, one table at a time.
6. Once the job reaches a terminal status, the client lands on `/workspace`:
   an outcome banner with real numbers, plus Customers and Agreements views
   populated from what was just persisted. Anything flagged during review
   shows inline as a plain-language annotation with evidence and a
   suggested fix; approve/reject persists immediately.

## Pipeline internals

- Intake parses every record; parse errors are attached to the row, not
  silently dropped.
- Normalize applies date, phone, container-ID, and name rules; unparseable
  values are flagged, never guessed.
- Resolve buckets records by a blocking key (name/phone/address) and only
  compares within a bucket — O(n), not O(n²). High-confidence matches
  auto-merge; everything else becomes a reviewable exception.
- Map converts legacy service codes to the target model through a versioned
  rule table, with confidence.
- Validate checks referential integrity (does an agreement reference a real
  customer/site) and pricing conflicts.
- A job's overall status becomes `failed` if review turns up any exception
  marked `critical` severity — that's a business-rule verdict ("needs human
  review before this can go live"), not a crash. The job's data is still
  fully persisted and the workspace still renders real results either way.

## Failure paths (what's actually implemented)

| Failure | What happens |
|---------|--------------|
| Blob content fails to fetch | The fetch is caught; that source file's content comes through empty rather than the request failing opaquely |
| A `COPY` write fails (bad data hitting a constraint) | Caught, the job is marked `failed` with the real error message stored on the job row — never left stuck at "in progress" forever |
| Pipeline takes too long / the invocation dies before finishing | The client's polling gives up after a bounded wait and shows a real error screen with a path back to `/migrate`, not an infinite spinner |
| API unreachable from the browser | Every fetch helper returns `null` on failure; the UI shows a real error/retry state per view, never fabricated numbers |
| Any exception is `critical` severity | Job status is `failed` (needs review), but all data persisted so far is real and viewable |

Not implemented, and not claimed: a message queue, circuit breakers,
dead-letter quarantine, checkpoint-based resume across separate runs, or
alerting. Those would matter at a different scale (many concurrent
tenants/jobs) than what this actually runs today — see `docs/Decisions.md`
(ADR-003) for the reasoning.
