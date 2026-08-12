/**
 * Commit actions: pure functions for batch commit and rollback.
 * Idempotent: same contentHash = same result. Batch-scoped rollback
 * restores proposals and exceptions to pre-commit state.
 */

import type { MappingProposal, ExceptionIssue } from "@/lib/types";
import type {
  CommitBatch,
  CommitRecord,
  CommitResult,
  CommitSnapshot,
  RollbackResult,
} from "./types";

let batchCounter = 0;

function nextBatchId(): string {
  batchCounter += 1;
  return `batch-${batchCounter}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Reset counter for deterministic tests. */
export function resetCommitCounters(): void {
  batchCounter = 0;
}

/**
 * Simple content hash for idempotency. In production this is SHA-256;
 * for the demo we use a deterministic string join.
 */
export function hashBatch(records: CommitRecord[]): string {
  const payload = records
    .map((r) => `${r.proposalId}:${r.targetTable}:${r.targetId}`)
    .sort()
    .join("|");
  return `sha256:${payload}`;
}

/**
 * Create a commit batch from approved mapping proposals.
 * Only proposals with status "proposed" (not already committed/rejected) are included.
 */
export function createCommitBatch(
  jobId: string,
  proposals: MappingProposal[],
  committedBy: string,
): CommitBatch {
  const records: CommitRecord[] = proposals
    .filter((p) => p.status === "proposed")
    .map((p) => ({
      proposalId: p.id,
      targetTable: p.targetTable,
      targetId: p.targetId,
      resolvedEntityId: p.resolvedEntityId,
      confidence: p.confidence,
      ruleVersion: p.ruleVersion,
    }));

  const contentHash = hashBatch(records);

  return {
    id: nextBatchId(),
    jobId,
    records,
    status: "pending",
    createdAt: nowIso(),
    committedBy,
    contentHash,
  };
}

/**
 * Take a snapshot of proposals and exceptions before commit.
 * This is the rollback safety net.
 */
export function takeSnapshot(
  batch: CommitBatch,
  proposals: MappingProposal[],
  exceptions: ExceptionIssue[],
): CommitSnapshot {
  return {
    batchId: batch.id,
    proposals: proposals.map((p) => ({ ...p })),
    exceptions: exceptions.map((e) => ({ ...e })),
    takenAt: nowIso(),
  };
}

/**
 * Commit a batch: mark all proposals as committed, resolve related exceptions.
 * Idempotent: if the batch is already committed, returns the same result.
 */
export function commitBatch(
  batch: CommitBatch,
  proposals: MappingProposal[],
  exceptions: ExceptionIssue[],
): { batch: CommitBatch; proposals: MappingProposal[]; exceptions: ExceptionIssue[]; result: CommitResult } {
  // Idempotency: already committed
  if (batch.status === "committed") {
    return {
      batch,
      proposals,
      exceptions,
      result: {
        batch,
        committedCount: batch.records.length,
        resolvedExceptions: [],
      },
    };
  }

  // Idempotency: already rolled back — cannot commit
  if (batch.status === "rolled_back") {
    throw new Error(`Batch ${batch.id} was rolled back and cannot be re-committed.`);
  }

  const recordIds = new Set(batch.records.map((r) => r.proposalId));
  const resolvedExceptions: string[] = [];

  // Mark proposals as committed
  const updatedProposals = proposals.map((p) => {
    if (recordIds.has(p.id)) {
      return { ...p, status: "committed" as const };
    }
    return p;
  });

  // Resolve exceptions that are tied to committed proposals
  const updatedExceptions = exceptions.map((e) => {
    // If the exception's evidence contains a committed proposal ID, auto-resolve it
    const hasCommittedEvidence = e.evidence.some((ev) => recordIds.has(ev));
    if (hasCommittedEvidence && e.reviewStatus === "open") {
      resolvedExceptions.push(e.id);
      return {
        ...e,
        reviewStatus: "approved" as const,
        resolvedAt: nowIso(),
      };
    }
    return e;
  });

  const committedBatch: CommitBatch = {
    ...batch,
    status: "committed",
    finalizedAt: nowIso(),
  };

  return {
    batch: committedBatch,
    proposals: updatedProposals,
    exceptions: updatedExceptions,
    result: {
      batch: committedBatch,
      committedCount: batch.records.length,
      resolvedExceptions,
    },
  };
}

/**
 * Roll back a batch: restore proposals and exceptions to pre-commit state.
 * Only works on committed batches. Idempotent: rolling back an already-
 * rolled-back batch returns the same result.
 */
export function rollbackBatch(
  batch: CommitBatch,
  proposals: MappingProposal[],
  exceptions: ExceptionIssue[],
  snapshot: CommitSnapshot,
): { batch: CommitBatch; proposals: MappingProposal[]; exceptions: ExceptionIssue[]; result: RollbackResult } {
  // Idempotency: already rolled back
  if (batch.status === "rolled_back") {
    return {
      batch,
      proposals,
      exceptions,
      result: {
        batch,
        rolledBackCount: batch.records.length,
        reopenedExceptions: [],
      },
    };
  }

  // Can only roll back committed batches
  if (batch.status !== "committed") {
    throw new Error(`Batch ${batch.id} is not committed (status: ${batch.status}). Only committed batches can be rolled back.`);
  }

  // Verify snapshot matches batch
  if (snapshot.batchId !== batch.id) {
    throw new Error(`Snapshot batchId ${snapshot.batchId} does not match batch ${batch.id}.`);
  }

  const reopenedExceptions: string[] = [];

  // Restore proposals from snapshot
  const restoredProposals = proposals.map((p) => {
    const snapP = snapshot.proposals.find((sp) => sp.id === p.id);
    if (snapP) {
      return { ...snapP };
    }
    return p;
  });

  // Restore exceptions from snapshot
  const restoredExceptions = exceptions.map((e) => {
    const snapE = snapshot.exceptions.find((se) => se.id === e.id);
    if (snapE) {
      if (snapE.reviewStatus === "open" && e.reviewStatus !== "open") {
        reopenedExceptions.push(e.id);
      }
      return { ...snapE };
    }
    return e;
  });

  const rolledBackBatch: CommitBatch = {
    ...batch,
    status: "rolled_back",
    finalizedAt: nowIso(),
  };

  return {
    batch: rolledBackBatch,
    proposals: restoredProposals,
    exceptions: restoredExceptions,
    result: {
      batch: rolledBackBatch,
      rolledBackCount: batch.records.length,
      reopenedExceptions,
    },
  };
}

/**
 * Check if a batch with the same contentHash already exists.
 * Used for idempotency before creating a new batch.
 */
export function findExistingBatch(
  batches: CommitBatch[],
  contentHash: string,
): CommitBatch | undefined {
  return batches.find((b) => b.contentHash === contentHash);
}
