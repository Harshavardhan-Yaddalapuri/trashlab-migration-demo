/**
 * Domain types for the TrashLab migration cockpit.
 * Typed agent contracts live here so every agent, rule, and store
 * speaks the same vocabulary. No `any` anywhere.
 */

export type SourceKind = "routepro-csv" | "quickbooks-export" | "transfer-spreadsheet" | "legacy-export";

export type MigrationStatus =
  | "pending"
  | "ingesting"
  | "normalizing"
  | "resolving"
  | "mapping"
  | "validating"
  | "review"
  | "committing"
  | "completed"
  | "failed"
  | "paused";

export type ReviewStatus = "open" | "approved" | "rejected";

export type ExceptionSeverity = "info" | "warning" | "critical";

export type Confidence = number; // 0..1

export interface SourceFile {
  id: string;
  kind: SourceKind;
  fileName: string;
  recordCount: number;
  rawHash: string;
  ingestedAt: string; // ISO-8601
  /** Raw file content. Optional: seed jobs may carry only metadata. */
  content?: string;
}

export interface RawRecord {
  id: string;
  sourceFileId: string;
  sourceRow: number;
  payload: Record<string, string>;
  rawHash: string;
}

export type EntityType =
  | "customer"
  | "site"
  | "container"
  | "agreement"
  | "route"
  | "ticket"
  | "unknown";

export interface NormalizedRecord {
  id: string;
  rawRecordId: string;
  entityType: EntityType;
  fields: Record<string, string>;
  normalizedAt: string;
}

export interface ResolvedEntity {
  id: string;
  entityType: EntityType;
  clusterId: string;
  confidence: Confidence;
  merged: boolean;
  canonicalFields: Record<string, string>;
}

export interface MappingProposal {
  id: string;
  resolvedEntityId: string;
  targetTable: string;
  targetId: string;
  confidence: Confidence;
  ruleVersion: string;
  status: "proposed" | "committed" | "rejected";
  /** Mapped target-model fields produced by the code mapper (agreements only). */
  mappedFields?: Record<string, unknown>;
}

export interface ExceptionIssue {
  id: string;
  jobId: string;
  type: string;
  severity: ExceptionSeverity;
  summary: string;
  evidence: string[];
  suggestedFix: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditEvent {
  id: string;
  jobId: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  at: string; // ISO-8601
}

export interface MigrationJob {
  id: string;
  tenantId: string;
  status: MigrationStatus;
  progress: number; // 0..1
  sourceFiles: SourceFile[];
  exceptions: ExceptionIssue[];
  createdAt: string;
  updatedAt: string;
}

export interface PipelineState {
  jobId: string;
  status: MigrationStatus;
  sourceFiles: SourceFile[];
  rawRecords: RawRecord[];
  normalized: NormalizedRecord[];
  resolved: ResolvedEntity[];
  proposals: MappingProposal[];
  exceptions: ExceptionIssue[];
  audit: AuditEvent[];
  progress: number;
  error?: string;
}
