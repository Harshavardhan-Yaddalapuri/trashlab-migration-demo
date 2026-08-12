/**
 * Review actions: pure functions for approve, edit-then-approve, reject, bulk-resolve.
 * Every action returns the updated exception card + an audit entry.
 * No side effects — callers persist the results.
 */

import type { ExceptionIssue } from "@/lib/types";
import type {
  ApproveMode,
  AuditEntry,
  BulkResolveResult,
  ExceptionCard,
  ReviewAction,
  ReviewDecision,
  ReviewRole,
} from "./types";

let decisionCounter = 0;
let auditCounter = 0;

function nextDecisionId(): string {
  decisionCounter += 1;
  return `dec-${decisionCounter}`;
}

function nextAuditId(): string {
  auditCounter += 1;
  return `aud-${auditCounter}`;
}

/** Reset counters for deterministic tests. */
export function resetCounters(): void {
  decisionCounter = 0;
  auditCounter = 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeAuditEntry(
  jobId: string,
  action: string,
  actor: string,
  reason: string,
  payload: Record<string, unknown>,
): AuditEntry {
  return {
    id: nextAuditId(),
    jobId,
    action,
    actor,
    at: nowIso(),
    reason,
    payload,
  };
}

/**
 * Approve an exception. In draft mode, records intent without committing.
 * In commit mode, finalizes the approval. Idempotent: approving an already-
 * approved exception returns the same card with no new audit entry.
 */
export function approveException(
  card: ExceptionCard,
  actor: string,
  role: ReviewRole,
  mode: ApproveMode,
  reason?: string,
): { card: ExceptionCard; decision: ReviewDecision; audit: AuditEntry } {
  if (card.reviewStatus === "approved" && mode === "commit") {
    // Idempotent: already committed.
    const decision: ReviewDecision = {
      id: nextDecisionId(),
      exceptionId: card.id,
      jobId: card.jobId,
      action: "approve",
      actor,
      role,
      at: nowIso(),
      reason: reason ?? "Approved (idempotent, already committed)",
      mode,
    };
    return {
      card,
      decision,
      audit: makeAuditEntry(card.jobId, "exception_approved", actor, reason ?? "Idempotent re-approve", {
        exceptionId: card.id,
        exceptionType: card.type,
        mode,
        idempotent: true,
      }),
    };
  }

  const updatedCard: ExceptionCard = {
    ...card,
    reviewStatus: mode === "commit" ? "approved" : card.reviewStatus,
    reviewedBy: actor,
    reviewedAt: nowIso(),
  };

  const decision: ReviewDecision = {
    id: nextDecisionId(),
    exceptionId: card.id,
    jobId: card.jobId,
    action: "approve",
    actor,
    role,
    at: nowIso(),
    reason: reason ?? "Approved",
    mode,
  };

  const audit = makeAuditEntry(card.jobId, "exception_approved", actor, reason ?? "Approved", {
    exceptionId: card.id,
    exceptionType: card.type,
    mode,
    previousStatus: card.reviewStatus,
  });

  return { card: updatedCard, decision, audit };
}

/**
 * Edit fields on an exception, then approve it.
 * The edited fields are recorded in the audit trail.
 */
export function editThenApprove(
  card: ExceptionCard,
  editedFields: Record<string, string>,
  actor: string,
  role: ReviewRole,
  reason?: string,
): { card: ExceptionCard; decision: ReviewDecision; audit: AuditEntry } {
  const updatedCard: ExceptionCard = {
    ...card,
    reviewStatus: "approved",
    editedFields,
    reviewedBy: actor,
    reviewedAt: nowIso(),
  };

  const decision: ReviewDecision = {
    id: nextDecisionId(),
    exceptionId: card.id,
    jobId: card.jobId,
    action: "edit_approve",
    actor,
    role,
    at: nowIso(),
    reason: reason ?? "Edited and approved",
    editedFields,
  };

  const audit = makeAuditEntry(card.jobId, "exception_edit_approved", actor, reason ?? "Edited and approved", {
    exceptionId: card.id,
    exceptionType: card.type,
    editedFields,
    previousStatus: card.reviewStatus,
  });

  return { card: updatedCard, decision, audit };
}

/**
 * Reject an exception with a required reason.
 * Rejection is recorded in the audit trail.
 */
export function rejectException(
  card: ExceptionCard,
  actor: string,
  role: ReviewRole,
  reason: string,
): { card: ExceptionCard; decision: ReviewDecision; audit: AuditEntry } {
  const updatedCard: ExceptionCard = {
    ...card,
    reviewStatus: "rejected",
    rejectionReason: reason,
    reviewedBy: actor,
    reviewedAt: nowIso(),
  };

  const decision: ReviewDecision = {
    id: nextDecisionId(),
    exceptionId: card.id,
    jobId: card.jobId,
    action: "reject",
    actor,
    role,
    at: nowIso(),
    reason,
  };

  const audit = makeAuditEntry(card.jobId, "exception_rejected", actor, reason, {
    exceptionId: card.id,
    exceptionType: card.type,
    previousStatus: card.reviewStatus,
  });

  return { card: updatedCard, decision, audit };
}

/**
 * Bulk-resolve all open exceptions of a given type with the same action.
 * Returns the updated cards, decisions, audit entries, and a summary.
 */
export function bulkResolve(
  cards: ExceptionCard[],
  exceptionType: string,
  action: ReviewAction,
  actor: string,
  role: ReviewRole,
  reason: string,
): {
  cards: ExceptionCard[];
  decisions: ReviewDecision[];
  auditEntries: AuditEntry[];
  result: BulkResolveResult;
} {
  const matching = cards.filter((c) => c.type === exceptionType && c.reviewStatus === "open");

  const decisions: ReviewDecision[] = [];
  const auditEntries: AuditEntry[] = [];
  const resolvedIds: string[] = [];

  const updatedCards = cards.map((card) => {
    if (card.type !== exceptionType || card.reviewStatus !== "open") {
      return card;
    }

    const newStatus = action === "reject" ? "rejected" : "approved";
    const updatedCard: ExceptionCard = {
      ...card,
      reviewStatus: newStatus,
      reviewedBy: actor,
      reviewedAt: nowIso(),
      ...(action === "reject" ? { rejectionReason: reason } : {}),
    };

    decisions.push({
      id: nextDecisionId(),
      exceptionId: card.id,
      jobId: card.jobId,
      action,
      actor,
      role,
      at: nowIso(),
      reason,
    });

    auditEntries.push(
      makeAuditEntry(card.jobId, `exception_${action}`, actor, reason, {
        exceptionId: card.id,
        exceptionType: card.type,
        bulkResolve: true,
        previousStatus: "open",
      }),
    );

    resolvedIds.push(card.id);
    return updatedCard;
  });

  const result: BulkResolveResult = {
    resolvedCount: matching.length,
    exceptionType,
    action,
    resolvedIds,
  };

  return { cards: updatedCards, decisions, auditEntries, result };
}

/**
 * Build an ExceptionCard from a core ExceptionIssue, adding review-specific fields.
 */
export function toExceptionCard(
  issue: ExceptionIssue,
  confidence: number,
  sourceRecord: string,
): ExceptionCard {
  return {
    ...issue,
    confidence,
    sourceRecord,
  };
}
