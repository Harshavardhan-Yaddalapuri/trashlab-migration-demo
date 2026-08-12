/**
 * Drizzle schema. snake_case plural tables, UUID-4 ids, money as integer cents.
 * The audit log is append-only; raw records are immutable.
 */

import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
    id: uuid("id").primaryKey().defaultRandom(),
    sourceFileId: uuid("source_file_id")
      .notNull()
      .references(() => sourceFiles.id),
    sourceRow: integer("source_row").notNull(),
    payload: jsonb("payload").notNull(),
    rawHash: text("raw_hash").notNull(),
  },
  (table) => [index("raw_records_source_idx").on(table.sourceFileId)],
);

export const exceptions = pgTable(
  "exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => migrationJobs.id),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").notNull().default([]),
    suggestedFix: text("suggested_fix").notNull(),
    reviewStatus: text("review_status").notNull().default("open"),
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
    id: uuid("id").primaryKey().defaultRandom(),
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
