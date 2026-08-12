/**
 * Append-only audit trail service.
 * Every review action is logged: who did what, when, and why.
 * The audit log IS the history — no deletes, no updates.
 */

import type { AuditEntry } from "./types";

/** In-memory audit store. In production this is the `audit_events` table. */
const auditLog: AuditEntry[] = [];

/** Append an entry to the audit log. Returns the entry for chaining. */
export function appendAudit(entry: AuditEntry): AuditEntry {
  auditLog.push(entry);
  return entry;
}

/** Append multiple entries at once. */
export function appendAuditBatch(entries: AuditEntry[]): AuditEntry[] {
  auditLog.push(...entries);
  return entries;
}

/** Get all audit entries for a job, ordered by time. */
export function getAuditForJob(jobId: string): AuditEntry[] {
  return auditLog
    .filter((e) => e.jobId === jobId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Get all audit entries for a specific exception. */
export function getAuditForException(exceptionId: string): AuditEntry[] {
  return auditLog
    .filter((e) => {
      const payload = e.payload as { exceptionId?: string };
      return payload.exceptionId === exceptionId;
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** Get all audit entries (for reporting). */
export function getAllAudit(): readonly AuditEntry[] {
  return auditLog;
}

/** Clear the audit log. For tests only. */
export function clearAudit(): void {
  auditLog.length = 0;
}

/** Count audit entries for a job. */
export function auditCountForJob(jobId: string): number {
  return auditLog.filter((e) => e.jobId === jobId).length;
}
