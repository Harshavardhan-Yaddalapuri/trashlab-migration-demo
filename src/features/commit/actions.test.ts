import { describe, expect, it, beforeEach } from "vitest";
import type { MappingProposal, ExceptionIssue } from "@/lib/types";
import {
  commitBatch,
  createCommitBatch,
  findExistingBatch,
  hashBatch,
  resetCommitCounters,
  rollbackBatch,
  takeSnapshot,
} from "./actions";
import type { CommitBatch, CommitRecord, CommitSnapshot } from "./types";

function makeProposal(overrides: Partial<MappingProposal> = {}): MappingProposal {
  return {
    id: "prop-001",
    resolvedEntityId: "ent-001",
    targetTable: "customers",
    targetId: "cust-001",
    confidence: 0.95,
    ruleVersion: "v1",
    status: "proposed",
    ...overrides,
  };
}

function makeException(overrides: Partial<ExceptionIssue> = {}): ExceptionIssue {
  return {
    id: "exc-001",
    jobId: "job-1",
    type: "pricing_conflict",
    severity: "warning",
    summary: "Test exception",
    evidence: ["prop-001"],
    suggestedFix: "Review",
    reviewStatus: "open",
    createdAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<CommitRecord> = {}): CommitRecord {
  return {
    proposalId: "prop-001",
    targetTable: "customers",
    targetId: "cust-001",
    resolvedEntityId: "ent-001",
    confidence: 0.95,
    ruleVersion: "v1",
    ...overrides,
  };
}

beforeEach(() => {
  resetCommitCounters();
});

// ─── createCommitBatch ────────────────────────────────────────────────

describe("createCommitBatch", () => {
  it("creates a batch from approved proposals", () => {
    const proposals = [
      makeProposal({ id: "prop-1", status: "proposed" }),
      makeProposal({ id: "prop-2", status: "proposed" }),
    ];

    const batch = createCommitBatch("job-1", proposals, "alice");

    expect(batch.jobId).toBe("job-1");
    expect(batch.records).toHaveLength(2);
    expect(batch.status).toBe("pending");
    expect(batch.committedBy).toBe("alice");
    expect(batch.contentHash).toBeDefined();
  });

  it("only includes proposals with status 'proposed'", () => {
    const proposals = [
      makeProposal({ id: "prop-1", status: "proposed" }),
      makeProposal({ id: "prop-2", status: "committed" }),
      makeProposal({ id: "prop-3", status: "rejected" }),
    ];

    const batch = createCommitBatch("job-1", proposals, "alice");

    expect(batch.records).toHaveLength(1);
    expect(batch.records[0].proposalId).toBe("prop-1");
  });

  it("generates unique batch IDs", () => {
    const proposals = [makeProposal()];
    const batch1 = createCommitBatch("job-1", proposals, "alice");
    const batch2 = createCommitBatch("job-1", proposals, "bob");

    expect(batch1.id).not.toBe(batch2.id);
  });
});

// ─── hashBatch ────────────────────────────────────────────────────────

describe("hashBatch", () => {
  it("produces the same hash for the same records in different order", () => {
    const records1: CommitRecord[] = [
      makeRecord({ proposalId: "prop-1" }),
      makeRecord({ proposalId: "prop-2" }),
    ];
    const records2: CommitRecord[] = [
      makeRecord({ proposalId: "prop-2" }),
      makeRecord({ proposalId: "prop-1" }),
    ];

    expect(hashBatch(records1)).toBe(hashBatch(records2));
  });

  it("produces different hashes for different records", () => {
    const records1: CommitRecord[] = [makeRecord({ proposalId: "prop-1" })];
    const records2: CommitRecord[] = [makeRecord({ proposalId: "prop-2" })];

    expect(hashBatch(records1)).not.toBe(hashBatch(records2));
  });

  it("returns a string starting with sha256:", () => {
    const records: CommitRecord[] = [makeRecord()];
    expect(hashBatch(records)).toMatch(/^sha256:/);
  });
});

// ─── commitBatch ──────────────────────────────────────────────────────

describe("commitBatch", () => {
  it("commits a batch and marks proposals as committed", () => {
    const proposals = [
      makeProposal({ id: "prop-1", status: "proposed" }),
      makeProposal({ id: "prop-2", status: "proposed" }),
    ];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const { batch: committed, proposals: updated, result } = commitBatch(batch, proposals, exceptions);

    expect(committed.status).toBe("committed");
    expect(committed.finalizedAt).toBeDefined();
    expect(updated[0].status).toBe("committed");
    expect(updated[1].status).toBe("committed");
    expect(result.committedCount).toBe(2);
  });

  it("auto-resolves exceptions tied to committed proposals", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions = [
      makeException({ id: "exc-1", evidence: ["prop-1"], reviewStatus: "open" }),
      makeException({ id: "exc-2", evidence: ["prop-2"], reviewStatus: "open" }),
    ];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const { exceptions: updated, result } = commitBatch(batch, proposals, exceptions);

    // exc-1 is tied to prop-1 → auto-resolved
    expect(updated[0].reviewStatus).toBe("approved");
    expect(updated[0].resolvedAt).toBeDefined();
    // exc-2 is not tied to any committed proposal → untouched
    expect(updated[1].reviewStatus).toBe("open");
    expect(result.resolvedExceptions).toEqual(["exc-1"]);
  });

  it("is idempotent: re-committing returns same result", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const first = commitBatch(batch, proposals, exceptions);
    const second = commitBatch(first.batch, first.proposals, first.exceptions);

    expect(second.batch.status).toBe("committed");
    expect(second.result.committedCount).toBe(1);
    // Proposals unchanged on second call
    expect(second.proposals[0].status).toBe("committed");
  });

  it("throws when committing a rolled-back batch", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    const { batch: committed } = commitBatch(batch, proposals, exceptions);
    const { batch: rolledBack } = rollbackBatch(committed, proposals, exceptions, snapshot);

    expect(() => commitBatch(rolledBack, proposals, exceptions)).toThrow("rolled back");
  });
});

// ─── takeSnapshot ─────────────────────────────────────────────────────

describe("takeSnapshot", () => {
  it("captures proposals and exceptions at a point in time", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions = [makeException({ id: "exc-1" })];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const snapshot = takeSnapshot(batch, proposals, exceptions);

    expect(snapshot.batchId).toBe(batch.id);
    expect(snapshot.proposals).toHaveLength(1);
    expect(snapshot.exceptions).toHaveLength(1);
    expect(snapshot.takenAt).toBeDefined();
  });

  it("creates a deep copy (mutations to original don't affect snapshot)", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const snapshot = takeSnapshot(batch, proposals, exceptions);

    // Mutate original
    proposals[0] = { ...proposals[0], status: "committed" };

    // Snapshot is unchanged
    expect(snapshot.proposals[0].status).toBe("proposed");
  });
});

// ─── rollbackBatch ────────────────────────────────────────────────────

describe("rollbackBatch", () => {
  it("rolls back a committed batch and restores proposals", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    const { batch: committed, proposals: committedProposals } = commitBatch(batch, proposals, exceptions);
    expect(committedProposals[0].status).toBe("committed");

    const { batch: rolledBack, proposals: restored } = rollbackBatch(
      committed,
      committedProposals,
      exceptions,
      snapshot,
    );

    expect(rolledBack.status).toBe("rolled_back");
    expect(rolledBack.finalizedAt).toBeDefined();
    expect(restored[0].status).toBe("proposed");
  });

  it("reopens exceptions that were auto-resolved by the commit", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions = [makeException({ id: "exc-1", evidence: ["prop-1"], reviewStatus: "open" })];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    const { batch: committed, proposals: committedProposals, exceptions: committedExceptions } =
      commitBatch(batch, proposals, exceptions);
    expect(committedExceptions[0].reviewStatus).toBe("approved");

    const { exceptions: restored, result } = rollbackBatch(
      committed,
      committedProposals,
      committedExceptions,
      snapshot,
    );

    expect(restored[0].reviewStatus).toBe("open");
    expect(result.reopenedExceptions).toEqual(["exc-1"]);
  });

  it("is idempotent: rolling back twice returns same result", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    const { batch: committed, proposals: committedProposals } = commitBatch(batch, proposals, exceptions);
    const first = rollbackBatch(committed, committedProposals, exceptions, snapshot);
    const second = rollbackBatch(first.batch, first.proposals, first.exceptions, snapshot);

    expect(second.batch.status).toBe("rolled_back");
    expect(second.result.rolledBackCount).toBe(1);
  });

  it("throws when rolling back a non-committed batch", () => {
    const proposals = [makeProposal()];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    expect(() => rollbackBatch(batch, proposals, exceptions, snapshot)).toThrow("not committed");
  });

  it("throws when snapshot batchId does not match", () => {
    const proposals = [makeProposal({ id: "prop-1", status: "proposed" })];
    const exceptions: ExceptionIssue[] = [];
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);

    const { batch: committed, proposals: committedProposals } = commitBatch(batch, proposals, exceptions);

    const wrongSnapshot: CommitSnapshot = {
      ...snapshot,
      batchId: "wrong-batch",
    };

    expect(() => rollbackBatch(committed, committedProposals, exceptions, wrongSnapshot)).toThrow(
      "does not match",
    );
  });
});

// ─── findExistingBatch ────────────────────────────────────────────────

describe("findExistingBatch", () => {
  it("finds a batch by contentHash", () => {
    const proposals = [makeProposal({ id: "prop-1" })];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const found = findExistingBatch([batch], batch.contentHash);
    expect(found).toBeDefined();
    expect(found!.id).toBe(batch.id);
  });

  it("returns undefined when no batch matches", () => {
    const proposals = [makeProposal({ id: "prop-1" })];
    const batch = createCommitBatch("job-1", proposals, "alice");

    const found = findExistingBatch([batch], "sha256:different");
    expect(found).toBeUndefined();
  });
});

// ─── end-to-end: commit → rollback → recommit ─────────────────────────

describe("commit lifecycle", () => {
  it("commit → rollback → recommit works correctly", () => {
    const proposals = [
      makeProposal({ id: "prop-1", status: "proposed" }),
      makeProposal({ id: "prop-2", status: "proposed" }),
    ];
    const exceptions = [
      makeException({ id: "exc-1", evidence: ["prop-1"], reviewStatus: "open" }),
    ];

    // Create and commit
    const batch = createCommitBatch("job-1", proposals, "alice");
    const snapshot = takeSnapshot(batch, proposals, exceptions);
    const { batch: committed, proposals: afterCommit, exceptions: afterCommitExc } =
      commitBatch(batch, proposals, exceptions);

    expect(committed.status).toBe("committed");
    expect(afterCommitExc[0].reviewStatus).toBe("approved");

    // Rollback
    const { batch: rolledBack, proposals: afterRollback, exceptions: afterRollbackExc } =
      rollbackBatch(committed, afterCommit, afterCommitExc, snapshot);

    expect(rolledBack.status).toBe("rolled_back");
    expect(afterRollback[0].status).toBe("proposed");
    expect(afterRollbackExc[0].reviewStatus).toBe("open");

    // Cannot recommit a rolled-back batch
    expect(() => commitBatch(rolledBack, afterRollback, afterRollbackExc)).toThrow("rolled back");
  });
});
