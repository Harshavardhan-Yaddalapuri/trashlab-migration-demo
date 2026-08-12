"use client";

/**
 * Client-side API helper for the real backend. Every function returns
 * `null` on any failure (network error, non-2xx, bad JSON) instead of
 * throwing, so callers can branch on it -- but a `null` result should be
 * rendered as a real loading/error/retry state, not silently swapped for
 * fabricated data. This is presented as production software; a real app
 * doesn't show fake numbers when a request fails.
 */

import type { SourceKind } from "@/lib/types";

export interface CreateJobSourceFile {
  kind: SourceKind;
  fileName: string;
  recordCount: number;
  content: string;
}

export interface CreatedJob {
  jobId: string;
  status: string;
}

export interface JobSourceFile {
  id: string;
  kind: SourceKind;
  fileName: string;
  recordCount: number;
  rawHash: string;
  ingestedAt: string;
}

export type StageId = "intake" | "normalize" | "resolve" | "map" | "validate" | "review" | "commit";
export type StagePhase = "waiting" | "active" | "done";
export interface StageProgressEntry {
  processed: number;
  total: number;
  phase: StagePhase;
}
export type StageProgressMap = Record<StageId, StageProgressEntry>;

export interface JobDetail {
  id: string;
  tenantId: string;
  status: string;
  progress: number;
  stageProgress: StageProgressMap | null;
  createdAt: string;
  updatedAt: string;
  sourceFiles: JobSourceFile[];
}

export interface JobException {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  evidence: string[];
  suggestedFix: string;
  reviewStatus: "open" | "approved" | "rejected";
  confidence: number;
  createdAt: string;
  resolvedAt: string | null;
}

export interface JobAuditEvent {
  id: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  at: string;
}

function num(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" ? value : 0;
}

/** Turn a real audit event into the same past-tense activity-feed copy the scripted demo used, but with real numbers. */
export function describeAuditEvent(event: JobAuditEvent): { message: string; level: "info" | "warn" | "error" } {
  switch (event.type) {
    case "JobStarted":
      return { message: `Parsing ${num(event.payload, "sourceFileCount")} source file(s)...`, level: "info" };
    case "SourceParsed": {
      const errors = num(event.payload, "parseErrorCount");
      return {
        message: `Parsed source files, ${num(event.payload, "recordCount")} raw records ingested${errors > 0 ? ` (${errors} parse errors)` : ""}.`,
        level: errors > 0 ? "warn" : "info",
      };
    }
    case "RecordNormalized":
      return {
        message: `Normalized ${num(event.payload, "normalizedCount")} records. ${num(event.payload, "flaggedCount")} flagged.`,
        level: "info",
      };
    case "CustomerResolved":
      return {
        message: `Resolved ${num(event.payload, "resolvedCount")} entities. ${num(event.payload, "autoMerged")} auto-merged, ${num(event.payload, "needsReview")} need review.`,
        level: "info",
      };
    case "MappingProposed":
      return {
        message: `Mapped ${num(event.payload, "proposalCount")} proposals. ${num(event.payload, "exceptionCount")} exceptions raised.`,
        level: "info",
      };
    case "ExceptionRaised":
      return {
        message: `Exception raised: ${String(event.payload.type ?? "unknown")} (${String(event.payload.severity ?? "info")}).`,
        level: event.payload.severity === "critical" ? "error" : event.payload.severity === "warning" ? "warn" : "info",
      };
    case "JobCompleted": {
      const failed = event.payload.failed === true;
      return {
        message: failed
          ? `Job failed review: ${num(event.payload, "criticalExceptions")} critical exception(s) among ${num(event.payload, "exceptionCount")} total.`
          : `Job completed. ${num(event.payload, "proposalCount")} proposals, ${num(event.payload, "exceptionCount")} exceptions.`,
        level: failed ? "error" : "info",
      };
    }
    default:
      return { message: event.type, level: "info" };
  }
}

export async function getJobAuditEvents(jobId: string): Promise<JobAuditEvent[] | null> {
  const result = await safeFetch<{ events: JobAuditEvent[] }>(`/api/v1/migration-jobs/${jobId}/audit`);
  return result?.events ?? null;
}

export interface EntityRecordException {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  evidence: string[];
  suggestedFix: string;
  confidence: number;
  reviewStatus: "open" | "approved" | "rejected";
}

export interface EntityRecord {
  id: string;
  entityType: string;
  confidence: number;
  fields: Record<string, string>;
  mappedFields: Record<string, unknown> | null;
  exceptions: EntityRecordException[];
}

export interface EntityRecordPage {
  items: EntityRecord[];
  nextCursor: string | null;
}

export async function getJobEntities(
  jobId: string,
  entityType: string,
  cursor?: string | null,
): Promise<EntityRecordPage | null> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return safeFetch<EntityRecordPage>(`/api/v1/migration-jobs/${jobId}/entities/${entityType}${query}`);
}

export interface JobReport {
  jobId: string;
  generatedAt: string;
  totalRecords: number;
  autoMapped: number;
  exceptionCount: number;
  autoMapRate: number;
  exceptionRate: number;
  silentErrors: number;
  goLiveDays: number;
  confidenceHistogram: Array<{ range: string; count: number; percentage: number }>;
  bySource: Array<{ source: string; totalRecords: number; autoMapped: number; exceptions: number; autoMapRate: number }>;
  byEntity: Array<{ entityType: string; totalRecords: number; autoMapped: number; exceptions: number; autoMapRate: number; avgConfidence: number }>;
}

async function safeFetch<T>(input: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function createMigrationJob(sourceFiles: CreateJobSourceFile[]): Promise<CreatedJob | null> {
  return safeFetch<CreatedJob>("/api/v1/migration-jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceFiles }),
  });
}

export async function getMigrationJob(jobId: string): Promise<JobDetail | null> {
  const result = await safeFetch<{ job: JobDetail }>(`/api/v1/migration-jobs/${jobId}`);
  return result?.job ?? null;
}

export async function getJobExceptions(jobId: string): Promise<JobException[] | null> {
  const result = await safeFetch<{ exceptions: JobException[] }>(`/api/v1/migration-jobs/${jobId}/exceptions`);
  return result?.exceptions ?? null;
}

export async function getJobReport(jobId: string): Promise<JobReport | null> {
  return safeFetch<JobReport>(`/api/jobs/${jobId}/report`);
}

export type ExceptionReviewRole = "owner" | "dispatcher" | "admin";

export async function approveException(
  jobId: string,
  exceptionId: string,
  actor: string,
  role: ExceptionReviewRole,
): Promise<boolean> {
  const result = await safeFetch<{ exception: { id: string } }>(
    `/api/jobs/${jobId}/exceptions/${exceptionId}/approve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor, role, mode: "commit" }),
    },
  );
  return result !== null;
}

export async function rejectException(
  jobId: string,
  exceptionId: string,
  actor: string,
  role: ExceptionReviewRole,
  reason: string,
): Promise<boolean> {
  const result = await safeFetch<{ exception: { id: string } }>(
    `/api/jobs/${jobId}/exceptions/${exceptionId}/reject`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor, role, reason }),
    },
  );
  return result !== null;
}

export async function bulkResolveExceptions(
  jobId: string,
  exceptionType: string,
  actor: string,
  role: ExceptionReviewRole,
  reason: string,
): Promise<boolean> {
  const result = await safeFetch<{ resolvedCount: number }>(
    `/api/jobs/${jobId}/exceptions/bulk-resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exceptionType, action: "approve", actor, role, reason }),
    },
  );
  return result !== null;
}
