/**
 * Builds a real ReportInput for a job from its persisted pipeline output.
 * No hardcoded demo numbers: every field here is a real query against what
 * the pipeline actually produced (or a fixed business SLA target, or a
 * deterministic eval-layer measurement — never a fabricated count).
 */

import { sql } from "drizzle-orm";
import { config } from "@/lib/config";
import type { ReportInput } from "@/features/report";
import { runGoldenSet } from "@/pipeline/eval/metrics";
import { db } from "@/server/db/client";

/**
 * Every proposal and (in this pipeline's current validator, every
 * exception) traces back through a resolved-entity id of the form
 * "e-<normalizedRecordId>" -> normalized_records -> raw_records ->
 * source_files. Stripping the "e-" prefix in SQL walks that chain without
 * requiring a denormalized source_file_id column.
 */
const SOURCE_KIND_FROM_ENTITY = sql`
  source_files.kind
`;

export async function buildReportInput(jobId: string): Promise<ReportInput | null> {
  const totalRecordsResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM raw_records WHERE job_id = ${jobId}`,
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

  // Per-source totals: every raw record, grouped by its source file kind.
  const sourceTotalsResult = await db.execute(sql`
    SELECT source_files.kind AS source, COUNT(*)::int AS total_records
    FROM raw_records
    JOIN source_files ON source_files.id = raw_records.source_file_id
    WHERE raw_records.job_id = ${jobId}
    GROUP BY source_files.kind
  `);

  // Per-source auto-mapped: proposals traced through resolved_entities ->
  // normalized_records -> raw_records -> source_files.
  const sourceAutoMappedResult = await db.execute(sql`
    SELECT ${SOURCE_KIND_FROM_ENTITY} AS source, COUNT(*)::int AS auto_mapped
    FROM proposals
    JOIN resolved_entities ON resolved_entities.id = proposals.resolved_entity_id
    JOIN normalized_records ON normalized_records.id = substring(resolved_entities.id from 3)
    JOIN raw_records ON raw_records.id = normalized_records.raw_record_id
    JOIN source_files ON source_files.id = raw_records.source_file_id
    WHERE proposals.job_id = ${jobId}
    GROUP BY source_files.kind
  `);

  const sourceExceptionsResult = await db.execute(sql`
    SELECT ${SOURCE_KIND_FROM_ENTITY} AS source, COUNT(*)::int AS exceptions
    FROM exceptions
    JOIN resolved_entities ON resolved_entities.id = exceptions.resolved_entity_id
    JOIN normalized_records ON normalized_records.id = substring(resolved_entities.id from 3)
    JOIN raw_records ON raw_records.id = normalized_records.raw_record_id
    JOIN source_files ON source_files.id = raw_records.source_file_id
    WHERE exceptions.job_id = ${jobId}
    GROUP BY source_files.kind
  `);

  const autoMappedBySource = new Map(sourceAutoMappedResult.rows.map((r) => [String(r.source), Number(r.auto_mapped)]));
  const exceptionsBySource = new Map(sourceExceptionsResult.rows.map((r) => [String(r.source), Number(r.exceptions)]));

  const sources = sourceTotalsResult.rows.map((r) => {
    const source = String(r.source);
    return {
      source,
      totalRecords: Number(r.total_records),
      autoMapped: autoMappedBySource.get(source) ?? 0,
      exceptions: exceptionsBySource.get(source) ?? 0,
    };
  });

  // Per-entity-type breakdown: normalized_records has the real entity type
  // for every record; proposals/exceptions carry it too (denormalized at
  // persist time for proposals, joined through resolved_entities for
  // exceptions).
  const entityTotalsResult = await db.execute(sql`
    SELECT entity_type, COUNT(*)::int AS total_records
    FROM normalized_records
    WHERE job_id = ${jobId}
    GROUP BY entity_type
  `);

  const entityAutoMappedResult = await db.execute(sql`
    SELECT entity_type, COUNT(*)::int AS auto_mapped, SUM(confidence)::float AS confidence_sum
    FROM proposals
    WHERE job_id = ${jobId}
    GROUP BY entity_type
  `);

  const entityExceptionsResult = await db.execute(sql`
    SELECT resolved_entities.entity_type AS entity_type, COUNT(*)::int AS exceptions
    FROM exceptions
    JOIN resolved_entities ON resolved_entities.id = exceptions.resolved_entity_id
    WHERE exceptions.job_id = ${jobId}
    GROUP BY resolved_entities.entity_type
  `);

  const autoMappedByEntity = new Map(
    entityAutoMappedResult.rows.map((r) => [
      String(r.entity_type),
      { autoMapped: Number(r.auto_mapped), confidenceSum: Number(r.confidence_sum ?? 0) },
    ]),
  );
  const exceptionsByEntity = new Map(entityExceptionsResult.rows.map((r) => [String(r.entity_type), Number(r.exceptions)]));

  const entities = entityTotalsResult.rows.map((r) => {
    const entityType = String(r.entity_type);
    const mapped = autoMappedByEntity.get(entityType);
    return {
      entityType,
      totalRecords: Number(r.total_records),
      autoMapped: mapped?.autoMapped ?? 0,
      exceptions: exceptionsByEntity.get(entityType) ?? 0,
      confidenceSum: mapped?.confidenceSum ?? 0,
      confidenceCount: mapped?.autoMapped ?? 0,
    };
  });

  const silentErrors = runGoldenSet().silentErrors;

  return {
    jobId,
    totalRecords,
    autoMapped,
    exceptionCount,
    silentErrors,
    goLiveDays: config.demo.goLiveDaysTarget,
    confidences,
    sources,
    entities,
  };
}
