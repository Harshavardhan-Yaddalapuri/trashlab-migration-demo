/**
 * Commit domain types. Batch commit of approved records, idempotent,
 * with batch-scoped rollback.
 */

import type { MappingProposal, ExceptionIssue } from "@/lib/types";

/** A single commit record: one mapping proposal being committed. */
export interface CommitRecord {
  /** The mapping proposal being committed. */
  proposalId: string;
  /** The target table this record maps to. */
  targetTable: string;
  /** The target entity ID in the TrashLab data model. */
  targetId: string;
  /** The resolved entity this proposal came from. */
  resolvedEntityId: string;
  /** Confidence at commit time. */
  confidence: number;
  /** The rule version used for this mapping. */
  ruleVersion: string;
}

/** A batch commit: groups multiple records into one atomic operation. */
export interface CommitBatch {
  /** Unique batch ID. */
  id: string;
  /** The job this batch belongs to. */
  jobId: string;
  /** Records in this batch. */
  records: CommitRecord[];
  /** Batch status. */
  status: "pending" | "committed" | "rolled_back";
  /** When the batch was created. ISO-8601. */
  createdAt: string;
  /** When the batch was committed or rolled back. */
  finalizedAt?: string;
  /** Who committed the batch. */
  committedBy?: string;
  /** SHA-256 of the batch payload for idempotency. */
  contentHash: string;
}

/** Result of a commit operation. */
export interface CommitResult {
  /** The batch that was committed. */
  batch: CommitBatch;
  /** How many records were committed. */
  committedCount: number;
  /** Any exceptions that were auto-resolved by the commit. */
  resolvedExceptions: string[];
}

/** Result of a rollback operation. */
export interface RollbackResult {
  /** The batch that was rolled back. */
  batch: CommitBatch;
  /** How many records were rolled back. */
  rolledBackCount: number;
  /** Exceptions that were re-opened by the rollback. */
  reopenedExceptions: string[];
}

/** Snapshot saved before commit for rollback support. */
export interface CommitSnapshot {
  /** The batch ID this snapshot belongs to. */
  batchId: string;
  /** The proposals as they were before commit. */
  proposals: MappingProposal[];
  /** The exceptions as they were before commit. */
  exceptions: ExceptionIssue[];
  /** When the snapshot was taken. */
  takenAt: string;
}
