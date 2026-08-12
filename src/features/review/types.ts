/**
 * Review domain types. Exception queue, HITL actions, role gating, audit.
 * Extends the core ExceptionIssue from @/lib/types with review-specific fields.
 */

import type { ExceptionIssue } from "@/lib/types";

/** Roles that gate exception resolution. */
export type ReviewRole = "owner" | "dispatcher" | "admin";

/** Exception types that are role-gated. */
export type GatedExceptionType = "pricing_conflict" | "route_conflict";

/** The action a reviewer takes on an exception. */
export type ReviewAction = "approve" | "edit_approve" | "reject" | "bulk_resolve";

/** Mode for approve: draft records intent, commit finalizes. */
export type ApproveMode = "draft" | "commit";

/** An enriched exception card for the review queue. */
export interface ExceptionCard extends ExceptionIssue {
  /** Confidence score from the agent that raised this exception (0..1). */
  confidence: number;
  /** The source record ID that triggered this exception. */
  sourceRecord: string;
  /** Fields edited during edit-then-approve. */
  editedFields?: Record<string, string>;
  /** Who last acted on this exception. */
  reviewedBy?: string;
  /** When the last review action occurred. */
  reviewedAt?: string;
  /** Rejection reason, when rejected. */
  rejectionReason?: string;
}

/** A single review decision, recorded in the audit trail. */
export interface ReviewDecision {
  /** Unique decision ID. */
  id: string;
  /** The exception this decision applies to. */
  exceptionId: string;
  /** The job this exception belongs to. */
  jobId: string;
  /** What action was taken. */
  action: ReviewAction;
  /** Who took the action. */
  actor: string;
  /** The actor's role. */
  role: ReviewRole;
  /** When the action was taken. ISO-8601. */
  at: string;
  /** Why the action was taken (rejection reason, or approval rationale). */
  reason: string;
  /** For edit_approve: the fields that were changed. */
  editedFields?: Record<string, string>;
  /** For approve: draft or commit. */
  mode?: ApproveMode;
}

/** An append-only audit entry. */
export interface AuditEntry {
  /** Unique entry ID. */
  id: string;
  /** The job this entry belongs to. */
  jobId: string;
  /** What happened. */
  action: string;
  /** Who did it. */
  actor: string;
  /** When it happened. ISO-8601. */
  at: string;
  /** Why it happened. */
  reason: string;
  /** Structured payload with full context. */
  payload: Record<string, unknown>;
}

/** Result of a bulk-resolve operation. */
export interface BulkResolveResult {
  /** How many exceptions were resolved. */
  resolvedCount: number;
  /** The exception type that was bulk-resolved. */
  exceptionType: string;
  /** The action applied to all matching exceptions. */
  action: ReviewAction;
  /** IDs of the resolved exceptions. */
  resolvedIds: string[];
}

/** Request body for approve endpoint. */
export interface ApproveRequest {
  mode: ApproveMode;
  actor: string;
  role: ReviewRole;
  reason?: string;
  editedFields?: Record<string, string>;
}

/** Request body for reject endpoint. */
export interface RejectRequest {
  actor: string;
  role: ReviewRole;
  reason: string;
}

/** Request body for bulk-resolve endpoint. */
export interface BulkResolveRequest {
  exceptionType: string;
  action: ReviewAction;
  actor: string;
  role: ReviewRole;
  reason: string;
}
