# Flow

Execution trace for a migration job.

## Happy path

1. User drops 4 legacy source files (RoutePro CSV, QuickBooks export,
   transfer spreadsheet, legacy export).
2. `POST /v1/tenants/{tenant_id}/migration-jobs` returns a job id immediately
   (async task pattern).
3. LangGraph StateGraph runs: ingest -> normalize -> resolve -> map -> validate
   -> review -> commit.
4. Intake parses every record; parse errors are reported, never dropped.
5. Normalize applies date, phone, id, and name rules.
6. Resolve buckets by blocking key (phonetic name + phone + address) and
   compares within buckets only: O(n), not O(n^2). Auto-merge above 0.9
   confidence; below becomes an exception.
7. Map converts legacy service codes to the target model with confidence.
8. Validate checks referential integrity and pricing conflicts.
9. Exceptions land in the queue with evidence and suggested fixes. A human
   approves, edits, or rejects. Every action is audited.
10. Commit is batch-scoped and idempotent; the report shows time-to-go-live,
    auto-map rate, exception rate, silent-error count, and confidence
    histogram.

## Failure paths

| Failure | Detection | Recovery |
|---------|-----------|----------|
| LLM provider down | Circuit breaker | Deterministic fallback |
| Poison record | Parse error | Dead-letter quarantine |
| Checkpoint stall | Progress metric | Alert + resume |
| Duplicate event | Idempotency keys | Same event, same result |
| Browser close | Persisted state | Resume from checkpoint |
| Partial commit | Batch atomicity | Batch-scoped rollback |
| Silent errors | Eval golden set | Regression blocks release |
| Queue overflow | Backpressure | Bounded queues |
| Schema change mid-job | Version check | Pause, re-evaluate affected only |
