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
 */

import { eq } from "drizzle-orm";
import { buildMigrationGraph, initialState } from "@/pipeline/graph";
import type { ExceptionIssue, MigrationStatus, ResolvedEntity, SourceFile } from "@/lib/types";
import { db } from "@/server/db/client";
import {
  auditEvents,
  exceptions,
  migrationJobs,
  normalizedRecords,
  proposals,
  rawRecords,
  resolvedEntities,
} from "@/server/db/schema";

// Postgres caps bind parameters at 65535 per statement; the widest table
// here (exceptions) has 13 columns, so 3000 rows/batch stays comfortably
// under that while cutting round-trips to Neon by 3x versus 1000.
const INSERT_BATCH_SIZE = 3000;
// Batches within one table's insert are independent (no ordering
// dependency), so run several concurrently rather than one round-trip at
// a time -- at 150k-record scale, sequential inserts alone can exceed the
// function's time budget. Bounded well under the pg Pool's connection max.
const INSERT_CONCURRENCY = 8;

async function insertInBatches<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
): Promise<void> {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
    chunks.push(rows.slice(i, i + INSERT_BATCH_SIZE));
  }
  for (let i = 0; i < chunks.length; i += INSERT_CONCURRENCY) {
    const group = chunks.slice(i, i + INSERT_CONCURRENCY);
    await Promise.all(group.map((chunk) => db.insert(table).values(chunk)));
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

  try {
    const resolvedById = new Map<string, ResolvedEntity>(final.resolved.map((r) => [r.id, r]));

    await insertInBatches(
      rawRecords,
      final.rawRecords.map((r) => ({
        id: r.id,
        jobId,
        sourceFileId: r.sourceFileId,
        sourceRow: r.sourceRow,
        payload: r.payload,
        rawHash: r.rawHash,
      })),
    );

    await insertInBatches(
      normalizedRecords,
      final.normalized.map((n) => ({
        id: n.id,
        jobId,
        rawRecordId: n.rawRecordId,
        entityType: n.entityType,
        fields: n.fields,
        normalizedAt: new Date(n.normalizedAt),
      })),
    );

    await insertInBatches(
      resolvedEntities,
      final.resolved.map((r) => ({
        id: r.id,
        jobId,
        entityType: r.entityType,
        clusterId: r.clusterId,
        confidence: r.confidence,
        merged: r.merged,
        canonicalFields: r.canonicalFields,
      })),
    );

    await insertInBatches(
      proposals,
      final.proposals.map((p) => ({
        id: p.id,
        jobId,
        resolvedEntityId: p.resolvedEntityId,
        entityType: resolvedById.get(p.resolvedEntityId)?.entityType ?? "unknown",
        targetTable: p.targetTable,
        targetId: p.targetId,
        confidence: p.confidence,
        ruleVersion: p.ruleVersion,
        status: p.status,
        mappedFields: p.mappedFields ?? null,
      })),
    );

    const resolvedIds = new Set(resolvedById.keys());
    await insertInBatches(
      exceptions,
      final.exceptions.map((e) => {
        const resolvedEntityId = inferResolvedEntityId(e, resolvedIds);
        const entity = resolvedEntityId ? resolvedById.get(resolvedEntityId) : undefined;
        return {
          id: e.id,
          jobId,
          type: e.type,
          severity: e.severity,
          summary: e.summary,
          evidence: e.evidence,
          suggestedFix: e.suggestedFix,
          reviewStatus: e.reviewStatus,
          resolvedEntityId,
          confidence: entity?.confidence ?? 0,
          sourceRecord: resolvedEntityId ?? "unknown",
          createdAt: new Date(e.createdAt),
          resolvedAt: e.resolvedAt ? new Date(e.resolvedAt) : null,
        };
      }),
    );

    await insertInBatches(
      auditEvents,
      final.audit.map((a) => ({
        id: a.id,
        jobId,
        type: a.type,
        actor: a.actor,
        payload: a.payload,
        at: new Date(a.at),
      })),
    );
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
