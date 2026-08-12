/**
 * Drizzle schema. snake_case plural tables, UUID-4 ids, money as integer cents.
 * The audit log is append-only; raw records are immutable.
 *
 * Job-scoped pipeline output tables (raw_records, normalized_records,
 * resolved_entities, proposals, exceptions, audit_events) use `text` ids:
 * the pipeline generates its own deterministic, prefix-chained string ids
 * (e.g. "n-<rawRecordId>", "e-<normalizedRecordId>", "p-<resolvedEntityId>")
 * rather than DB-issued UUIDs, and that chain is what makes pipeline output
 * traceable back through every stage.
 */

import { boolean, index, integer, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const migrationJobs = pgTable(
  "migration_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: text("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    /** Real per-stage counts, updated as the pipeline streams through each node. */
    stageProgress: jsonb("stage_progress"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("migration_jobs_tenant_status_idx").on(table.tenantId, table.status)],
);

export const sourceFiles = pgTable("source_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => migrationJobs.id),
  kind: text("kind").notNull(),
  fileName: text("file_name").notNull(),
  recordCount: integer("record_count").notNull().default(0),
  rawHash: text("raw_hash").notNull(),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rawRecords = pgTable(
  "raw_records",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    sourceFileId: uuid("source_file_id")
      .notNull()
      .references(() => sourceFiles.id),
    sourceRow: integer("source_row").notNull(),
    payload: jsonb("payload").notNull(),
    rawHash: text("raw_hash").notNull(),
  },
  (table) => [
    index("raw_records_source_idx").on(table.sourceFileId),
    index("raw_records_job_idx").on(table.jobId),
  ],
);

export const normalizedRecords = pgTable(
  "normalized_records",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    rawRecordId: text("raw_record_id")
      .notNull()
      .references(() => rawRecords.id),
    entityType: text("entity_type").notNull(),
    fields: jsonb("fields").notNull(),
    normalizedAt: timestamp("normalized_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("normalized_records_job_entity_idx").on(table.jobId, table.entityType),
  ],
);

export const resolvedEntities = pgTable(
  "resolved_entities",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    entityType: text("entity_type").notNull(),
    clusterId: text("cluster_id").notNull(),
    confidence: real("confidence").notNull(),
    merged: boolean("merged").notNull().default(false),
    canonicalFields: jsonb("canonical_fields").notNull(),
  },
  (table) => [
    index("resolved_entities_job_entity_idx").on(table.jobId, table.entityType),
  ],
);

export const proposals = pgTable(
  "proposals",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    resolvedEntityId: text("resolved_entity_id")
      .notNull()
      .references(() => resolvedEntities.id),
    entityType: text("entity_type").notNull(),
    targetTable: text("target_table").notNull(),
    targetId: text("target_id").notNull(),
    confidence: real("confidence").notNull(),
    ruleVersion: text("rule_version").notNull(),
    status: text("status").notNull().default("proposed"),
    mappedFields: jsonb("mapped_fields"),
  },
  (table) => [index("proposals_job_idx").on(table.jobId)],
);

export const exceptions = pgTable(
  "exceptions",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").notNull().default([]),
    suggestedFix: text("suggested_fix").notNull(),
    reviewStatus: text("review_status").notNull().default("open"),
    /** Best-effort trace back to the resolved entity that raised this exception, when derivable. */
    resolvedEntityId: text("resolved_entity_id"),
    /** Confidence of the entity/proposal that raised this exception, when known. */
    confidence: real("confidence").notNull().default(0),
    /** Best-effort source record reference for display (falls back to resolvedEntityId). */
    sourceRecord: text("source_record").notNull().default("unknown"),
    editedFields: jsonb("edited_fields"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("exceptions_job_type_status_idx").on(table.jobId, table.type, table.reviewStatus),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    type: text("type").notNull(),
    actor: text("actor").notNull(),
    payload: jsonb("payload").notNull().default({}),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_events_job_idx").on(table.jobId)],
);
