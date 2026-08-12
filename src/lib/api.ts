"use client";

/**
 * Client-side API helper for the real backend. Every function returns
 * `null` on any failure (network error, non-2xx, bad JSON) instead of
 * throwing, so callers can fall back to the scripted demo data with a
 * simple `?? fallback`. The demo must never break because the API is
 * unreachable.
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

export interface JobDetail {
  id: string;
  tenantId: string;
  status: string;
  progress: number;
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
