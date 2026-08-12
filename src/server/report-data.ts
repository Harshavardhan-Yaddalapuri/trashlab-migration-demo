/**
 * Builds a real ReportInput for a job from its persisted pipeline output.
 * No hardcoded demo numbers: every field here is a real query against what
 * the pipeline actually produced (or a fixed business SLA target, or a
 * deterministic eval-layer measurement -- never a fabricated count).
 *
 * raw_records and normalized_records are not persisted per-row in Postgres
 * (see pipeline-runner.ts) -- at 150k-record scale that's ~300k extra rows
 * nothing in the product actually reads. totalRecords instead comes from
 * source_files.record_count, an exact count already captured at upload
 * time. The per-source/per-entity breakdown fields (bySource, byEntity)
 * that used to trace through those tables aren't wired into any current UI
 * (the workspace outcome banner only reads totalRecords, exceptionCount,
 * goLiveDays), so they're left empty rather than rebuilt.
 */

import { sql } from "drizzle-orm";
import { config } from "@/lib/config";
import type { ReportInput } from "@/features/report";
import { runGoldenSet } from "@/pipeline/eval/metrics";
import { db } from "@/server/db/client";

export async function buildReportInput(jobId: string): Promise<ReportInput | null> {
  const totalRecordsResult = await db.execute(
    sql`SELECT COALESCE(SUM(record_count), 0)::int AS count FROM source_files WHERE job_id = ${jobId}`,
  );
  const totalRecords = Number(totalRecordsResult.rows[0]?.count ?? 0);
  if (totalRecords === 0) {
    return null;
  }

  const autoMappedResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM proposals WHERE job_id = ${jobId}`,
  );
  const autoMapped = Number(autoMappedResult.rows[0]?.count ?? 0);

  const exceptionCountResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM exceptions WHERE job_id = ${jobId}`,
  );
  const exceptionCount = Number(exceptionCountResult.rows[0]?.count ?? 0);

  const confidencesResult = await db.execute(
    sql`SELECT confidence FROM proposals WHERE job_id = ${jobId}`,
  );
  const confidences = confidencesResult.rows.map((r) => Number(r.confidence));

  const silentErrors = runGoldenSet().silentErrors;

  return {
    jobId,
    totalRecords,
    autoMapped,
    exceptionCount,
    silentErrors,
    goLiveDays: config.demo.goLiveDaysTarget,
    confidences,
    sources: [],
    entities: [],
  };
}
