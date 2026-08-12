/**
 * Runs the real LangGraph migration pipeline for a job and persists its
 * output to Postgres. Server-side only.
 *
 * The pipeline generates its own deterministic, prefix-chained string ids
 * at each stage (raw -> "n-<rawId>" -> "e-<normalizedId>"/clusterId ->
 * "p-<resolvedId>" -> "exc-*"). Exceptions carry that lineage in their own
 * id ("exc-map-<resolvedEntityId>", "exc-<clusterId>"), which is how we
 * trace an exception back to the entity that raised it without touching
 * pipeline logic.
 *
 * Progress is streamed, not invoked atomically: graph.stream(..., { streamMode:
 * "values" }) yields the accumulated state after every node, so migration_jobs
 * is updated with real per-stage counts as the pipeline actually runs, instead
 * of jumping straight from "pending" to a fully-computed final state.
 *
 * Persistence uses Postgres COPY (not parameterized batch INSERTs), and
 * only for resolved_entities, proposals, exceptions, and audit_events --
 * raw_records and normalized_records stay in-memory only (used by later
 * pipeline stages) rather than written per-row to Postgres. Nothing in the
 * product reads either table today (see report-data.ts), and at 150k-record
 * scale writing them anyway is ~300k rows of pure waste that used to make
 * even COPY too slow to finish inside one serverless invocation's time
 * budget.
 */

import { eq, sql } from "drizzle-orm";
import { from as copyFrom } from "pg-copy-streams";
import { buildMigrationGraph, initialState } from "@/pipeline/graph";
import type { ExceptionIssue, MigrationStatus, ResolvedEntity, SourceFile } from "@/lib/types";
import { db, pool } from "@/server/db/client";
import { migrationJobs } from "@/server/db/schema";

// TEMP diagnostic: console.log from after() background execution isn't
// reliably showing up in `vercel logs`, so checkpoint timing goes to a
// real committed DB write instead, which we can query with certainty.
async function debugLog(jobId: string, msg: string): Promise<void> {
  try {
    await db.execute(
      sql`UPDATE migration_jobs SET persist_log = persist_log || ${JSON.stringify([`${Date.now()} ${msg}`])}::jsonb WHERE id = ${jobId}`,
    );
  } catch {
    // best-effort diagnostic only
  }
}

/** CSV-encodes one value for COPY ... FORMAT csv. Null/undefined become an
 * unquoted empty field (COPY's CSV-mode NULL representation); everything
 * else is quoted so numbers, dates, and JSON text all round-trip safely
 * through the same code path without per-type special-casing. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",") + "\n";
}

async function copyInsert<T>(
  jobId: string,
  tableName: string,
  columns: string[],
  rows: T[],
  rowToValues: (row: T) => unknown[],
): Promise<void> {
  if (rows.length === 0) return;
  const t0 = Date.now();
  await debugLog(jobId, `copy ${tableName} start (${rows.length} rows)`);
  const client = await pool.connect();
  try {
    const stream = client.query(copyFrom(`COPY ${tableName} (${columns.join(", ")}) FROM STDIN WITH (FORMAT csv)`));
    const csv = rows.map((row) => csvRow(rowToValues(row))).join("");
    const tBuilt = Date.now();
    await debugLog(jobId, `copy ${tableName} built (${tBuilt - t0}ms), sending`);
    await new Promise<void>((resolve, reject) => {
      stream.on("error", reject);
      stream.on("finish", resolve);
      stream.end(csv);
    });
    await debugLog(jobId, `copy ${tableName} done (${Date.now() - t0}ms total)`);
  } finally {
    client.release();
  }
}

/**
 * Every exception-raising path in the pipeline puts the resolved entity id
 * either as evidence[0] (validator, mapper) or embedded in the exception id
 * itself (entity resolver: "exc-<clusterId>"). Checking candidates against
 * the actual resolved-entity id set (rather than trusting string shape)
 * keeps this correct even if an agent's id convention changes.
 */
function inferResolvedEntityId(exception: ExceptionIssue, resolvedIds: Set<string>): string | null {
  const evidenceCandidate = exception.evidence[0];
  if (evidenceCandidate !== undefined && resolvedIds.has(evidenceCandidate)) {
    return evidenceCandidate;
  }
  if (exception.id.startsWith("exc-map-")) {
    const candidate = exception.id.slice("exc-map-".length);
    if (resolvedIds.has(candidate)) return candidate;
  }
  if (exception.id.startsWith("exc-")) {
    const candidate = exception.id.slice("exc-".length);
    if (resolvedIds.has(candidate)) return candidate;
  }
  return null;
}

type GraphState = ReturnType<typeof initialState>;

export const STAGE_IDS = ["intake", "normalize", "resolve", "map", "validate", "review", "commit"] as const;
export type StageId = (typeof STAGE_IDS)[number];
export type StagePhase = "waiting" | "active" | "done";
export interface StageProgressEntry {
  processed: number;
  total: number;
  phase: StagePhase;
}
export type StageProgressMap = Record<StageId, StageProgressEntry>;

/**
 * Each node sets `status` to the name of the stage that JUST completed
 * (see graph.ts: ingestNode -> "ingesting", etc). This maps that status to
 * how many of the 7 UI stages are done.
 */
function completedStageIndex(status: MigrationStatus): number {
  switch (status) {
    case "ingesting":
      return 0;
    case "normalizing":
      return 1;
    case "resolving":
      return 2;
    case "mapping":
      return 3;
    case "validating":
      return 4;
    case "review":
      return 5;
    case "committing":
    case "completed":
    case "failed":
      return 6;
    default:
      return -1;
  }
}

function computeStageProgress(state: GraphState, totalRaw: number): StageProgressMap {
  const doneThrough = completedStageIndex(state.status);

  const processed: Record<StageId, number> = {
    intake: state.rawRecords.length,
    normalize: state.normalized.length,
    resolve: state.resolved.length,
    map: state.proposals.length,
    validate: state.proposals.length,
    review: state.exceptions.length,
    commit: doneThrough >= 6 ? totalRaw : 0,
  };
  const total: Record<StageId, number> = {
    intake: totalRaw,
    normalize: state.rawRecords.length || totalRaw,
    resolve: state.normalized.length || totalRaw,
    map: state.resolved.length || totalRaw,
    validate: state.proposals.length || 0,
    review: state.exceptions.length || 0,
    commit: totalRaw,
  };

  const map = {} as StageProgressMap;
  STAGE_IDS.forEach((id, i) => {
    const phase: StagePhase = i <= doneThrough ? "done" : i === doneThrough + 1 ? "active" : "waiting";
    map[id] = { processed: processed[id], total: total[id], phase };
  });
  return map;
}

export interface PipelineRunResult {
  status: MigrationStatus;
  progress: number;
  rawRecordCount: number;
  proposalCount: number;
  exceptionCount: number;
}

export async function runPipelineForJob(jobId: string, sourceFiles: SourceFile[]): Promise<PipelineRunResult> {
  const runStart = Date.now();
  console.log(`[pipeline] ${jobId} start`);
  const graph = buildMigrationGraph();
  const state = initialState(jobId, sourceFiles);
  const totalRaw = sourceFiles.reduce((sum, f) => sum + f.recordCount, 0);

  let final: GraphState | undefined;
  try {
    const stream = await graph.stream(state, {
      configurable: { thread_id: jobId },
      streamMode: "values",
    });
    for await (const snapshot of stream) {
      final = snapshot as GraphState;
      const stageProgress = computeStageProgress(final, totalRaw);
      const isTerminal = final.status === "completed" || final.status === "failed";
      // Don't report a terminal status until persistence below actually
      // finishes -- otherwise pollers could see "completed" before the
      // records/exceptions/report they'd fetch next actually exist.
      await db
        .update(migrationJobs)
        .set({
          status: isTerminal ? "committing" : final.status,
          progress: isTerminal ? 95 : Math.round(final.progress * 100),
          stageProgress,
          updatedAt: new Date(),
        })
        .where(eq(migrationJobs.id, jobId));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(migrationJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(migrationJobs.id, jobId));
    throw err;
  }

  if (!final) {
    throw new Error(`pipeline produced no state for job ${jobId}`);
  }
  console.log(
    `[pipeline] ${jobId} compute done in ${Date.now() - runStart}ms: raw=${final.rawRecords.length} normalized=${final.normalized.length} resolved=${final.resolved.length} proposals=${final.proposals.length} exceptions=${final.exceptions.length} audit=${final.audit.length}`,
  );

  try {
    const resolvedById = new Map<string, ResolvedEntity>(final.resolved.map((r) => [r.id, r]));
    const resolvedIds = new Set(resolvedById.keys());

    // TEMP DIAGNOSTIC: sequential instead of concurrent (Promise.all) --
    // testing whether 4 simultaneous pool.connect()+COPY streams right
    // after ~28s of heavy pipeline compute contend for something (memory,
    // connections) that stalls all of them, even though a standalone
    // benchmark showed a single COPY of this data transfers in ~1s.
    await debugLog(jobId, `persist start (compute took ${Date.now() - runStart}ms)`);
    await copyInsert(
      jobId,
      "resolved_entities",
      ["id", "job_id", "entity_type", "cluster_id", "confidence", "merged", "canonical_fields"],
      final.resolved,
      (r) => [r.id, jobId, r.entityType, r.clusterId, r.confidence, r.merged, r.canonicalFields],
    );
    await copyInsert(
      jobId,
      "proposals",
      ["id", "job_id", "resolved_entity_id", "entity_type", "target_table", "target_id", "confidence", "rule_version", "status", "mapped_fields"],
      final.proposals,
      (p) => [
        p.id,
        jobId,
        p.resolvedEntityId,
        resolvedById.get(p.resolvedEntityId)?.entityType ?? "unknown",
        p.targetTable,
        p.targetId,
        p.confidence,
        p.ruleVersion,
        p.status,
        p.mappedFields ?? null,
      ],
    );
    await copyInsert(
      jobId,
      "exceptions",
      [
        "id",
        "job_id",
        "type",
        "severity",
        "summary",
        "evidence",
        "suggested_fix",
        "review_status",
        "resolved_entity_id",
        "confidence",
        "source_record",
        "created_at",
        "resolved_at",
      ],
      final.exceptions,
      (e) => {
        const resolvedEntityId = inferResolvedEntityId(e, resolvedIds);
        const entity = resolvedEntityId ? resolvedById.get(resolvedEntityId) : undefined;
        return [
          e.id,
          jobId,
          e.type,
          e.severity,
          e.summary,
          e.evidence,
          e.suggestedFix,
          e.reviewStatus,
          resolvedEntityId,
          entity?.confidence ?? 0,
          resolvedEntityId ?? "unknown",
          new Date(e.createdAt),
          e.resolvedAt ? new Date(e.resolvedAt) : null,
        ];
      },
    );
    await copyInsert(jobId, "audit_events", ["id", "job_id", "type", "actor", "payload", "at"], final.audit, (a) => [
      a.id,
      jobId,
      a.type,
      a.actor,
      a.payload,
      new Date(a.at),
    ]);
    console.log(`[pipeline] ${jobId} persistence done in ${Date.now() - runStart}ms total`);
  } catch (err) {
    // Persistence failed partway through -- don't leave the job stuck at
    // "committing" forever with no way for a poller to know it died.
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(migrationJobs)
      .set({ status: "failed", error: `Persistence failed: ${message}`, updatedAt: new Date() })
      .where(eq(migrationJobs.id, jobId));
    throw err;
  }

  await db
    .update(migrationJobs)
    .set({
      status: final.status,
      progress: Math.round(final.progress * 100),
      stageProgress: computeStageProgress(final, totalRaw),
      error: final.error ?? null,
      updatedAt: new Date(),
    })
    .where(eq(migrationJobs.id, jobId));

  return {
    status: final.status,
    progress: final.progress,
    rawRecordCount: final.rawRecords.length,
    proposalCount: final.proposals.length,
    exceptionCount: final.exceptions.length,
  };
}
