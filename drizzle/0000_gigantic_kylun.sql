CREATE TABLE "audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exceptions" (
	"id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"summary" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"suggested_fix" text NOT NULL,
	"review_status" text DEFAULT 'open' NOT NULL,
	"resolved_entity_id" text,
	"confidence" real DEFAULT 0 NOT NULL,
	"source_record" text DEFAULT 'unknown' NOT NULL,
	"edited_fields" jsonb,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	CONSTRAINT "exceptions_job_id_id_pk" PRIMARY KEY("job_id","id")
);
--> statement-breakpoint
CREATE TABLE "migration_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"stage_progress" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "normalized_records" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"raw_record_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"fields" jsonb NOT NULL,
	"normalized_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"resolved_entity_id" text NOT NULL,
	"entity_type" text NOT NULL,
	"target_table" text NOT NULL,
	"target_id" text NOT NULL,
	"confidence" real NOT NULL,
	"rule_version" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"mapped_fields" jsonb
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"source_file_id" uuid NOT NULL,
	"source_row" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"raw_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resolved_entities" (
	"id" text NOT NULL,
	"job_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"cluster_id" text NOT NULL,
	"confidence" real NOT NULL,
	"merged" boolean DEFAULT false NOT NULL,
	"canonical_fields" jsonb NOT NULL,
	CONSTRAINT "resolved_entities_job_id_id_pk" PRIMARY KEY("job_id","id")
);
--> statement-breakpoint
CREATE TABLE "source_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_name" text NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"raw_hash" text NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exceptions" ADD CONSTRAINT "exceptions_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_jobs" ADD CONSTRAINT "migration_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_records" ADD CONSTRAINT "normalized_records_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "normalized_records" ADD CONSTRAINT "normalized_records_raw_record_id_raw_records_id_fk" FOREIGN KEY ("raw_record_id") REFERENCES "public"."raw_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_source_file_id_source_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."source_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resolved_entities" ADD CONSTRAINT "resolved_entities_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_job_id_migration_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."migration_jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_events_job_idx" ON "audit_events" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "exceptions_job_type_status_idx" ON "exceptions" USING btree ("job_id","type","review_status");--> statement-breakpoint
CREATE INDEX "migration_jobs_tenant_status_idx" ON "migration_jobs" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "normalized_records_job_entity_idx" ON "normalized_records" USING btree ("job_id","entity_type");--> statement-breakpoint
CREATE INDEX "proposals_job_idx" ON "proposals" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "raw_records_source_idx" ON "raw_records" USING btree ("source_file_id");--> statement-breakpoint
CREATE INDEX "raw_records_job_idx" ON "raw_records" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "resolved_entities_job_entity_idx" ON "resolved_entities" USING btree ("job_id","entity_type");