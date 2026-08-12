import { describe, expect, it, beforeEach } from "vitest";
import type { ExceptionIssue } from "@/lib/types";
import {
  approveException,
  bulkResolve,
  editThenApprove,
  rejectException,
  resetCounters,
  toExceptionCard,
} from "./actions";
import {
  appendAudit,
  appendAuditBatch,
  auditCountForJob,
  clearAudit,
  getAllAudit,
  getAuditForException,
  getAuditForJob,
} from "./audit";
import {
  canBulkResolve,
  canResolve,
  denialReason,
  requiredRoleFor,
} from "./role-gate";
import {
  clearExceptionStore,
  getException,
  getExceptionsForJob,
  putException,
  putExceptions,
  updateException,
} from "./exception-store";
import type { ExceptionCard, ReviewRole } from "./types";

function makeIssue(overrides: Partial<ExceptionIssue> = {}): ExceptionIssue {
  return {
    id: "exc-001",
    jobId: "job-1",
    type: "pricing_conflict",
    severity: "warning",
    summary: "Conflicting rates for container RC-1023",
    evidence: ["RC-1023", "S-00001", "p-1", "p-2"],
    suggestedFix: "Review both agreements and pick the canonical rate",
    reviewStatus: "open",
    createdAt: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

function makeCard(overrides: Partial<ExceptionCard> = {}): ExceptionCard {
  return {
    ...makeIssue(overrides),
    confidence: 0.75,
    sourceRecord: "raw-001",
    ...overrides,
  };
}

beforeEach(() => {
  resetCounters();
  clearAudit();
  clearExceptionStore();
});

// ─── approveException ────────────────────────────────────────────────

describe("approveException", () => {
  it("commits an open exception to approved", () => {
    const card = makeCard();
    const { card: updated, audit } = approveException(card, "alice", "owner", "commit");

    expect(updated.reviewStatus).toBe("approved");
    expect(updated.reviewedBy).toBe("alice");
    expect(updated.reviewedAt).toBeDefined();
    expect(audit.action).toBe("exception_approved");
    expect(audit.actor).toBe("alice");
    expect(audit.reason).toBe("Approved");
  });

  it("draft mode does not change reviewStatus", () => {
    const card = makeCard();
    const { card: updated } = approveException(card, "alice", "owner", "draft");

    expect(updated.reviewStatus).toBe("open");
    expect(updated.reviewedBy).toBe("alice");
  });

  it("is idempotent on already-approved exception", () => {
    const card = makeCard({ reviewStatus: "approved" });
    const { card: updated, audit } = approveException(card, "alice", "owner", "commit");

    expect(updated.reviewStatus).toBe("approved");
    expect(audit.payload).toHaveProperty("idempotent", true);
  });

  it("records a custom reason in the audit", () => {
    const card = makeCard();
    const { audit } = approveException(card, "bob", "admin", "commit", "Looks correct");

    expect(audit.reason).toBe("Looks correct");
  });
});

// ─── editThenApprove ─────────────────────────────────────────────────

describe("editThenApprove", () => {
  it("edits fields and approves the exception", () => {
    const card = makeCard();
    const editedFields = { rateCents: "12000" };
    const { card: updated, decision, audit } = editThenApprove(
      card,
      editedFields,
      "alice",
      "owner",
      "Fixed the rate",
    );

    expect(updated.reviewStatus).toBe("approved");
    expect(updated.editedFields).toEqual(editedFields);
    expect(decision.action).toBe("edit_approve");
    expect(decision.editedFields).toEqual(editedFields);
    expect(audit.action).toBe("exception_edit_approved");
    expect(audit.payload).toHaveProperty("editedFields", editedFields);
  });
});

// ─── rejectException ─────────────────────────────────────────────────

describe("rejectException", () => {
  it("rejects an exception with a reason", () => {
    const card = makeCard();
    const { card: updated, decision, audit } = rejectException(
      card,
      "bob",
      "dispatcher",
      "Not a real conflict — same customer, different service dates",
    );

    expect(updated.reviewStatus).toBe("rejected");
    expect(updated.rejectionReason).toBe("Not a real conflict — same customer, different service dates");
    expect(updated.reviewedBy).toBe("bob");
    expect(decision.action).toBe("reject");
    expect(decision.reason).toContain("Not a real conflict");
    expect(audit.action).toBe("exception_rejected");
    expect(audit.actor).toBe("bob");
  });
});

// ─── bulkResolve ─────────────────────────────────────────────────────

describe("bulkResolve", () => {
  it("bulk-resolves all open exceptions of a given type", () => {
    const cards: ExceptionCard[] = [
      makeCard({ id: "exc-1", type: "pricing_conflict", reviewStatus: "open" }),
      makeCard({ id: "exc-2", type: "pricing_conflict", reviewStatus: "open" }),
      makeCard({ id: "exc-3", type: "orphan_container", reviewStatus: "open" }),
      makeCard({ id: "exc-4", type: "pricing_conflict", reviewStatus: "approved" }),
    ];

    const { cards: updated, decisions, auditEntries, result } = bulkResolve(
      cards,
      "pricing_conflict",
      "approve",
      "alice",
      "owner",
      "All pricing conflicts reviewed and correct",
    );

    expect(result.resolvedCount).toBe(2);
    expect(result.exceptionType).toBe("pricing_conflict");
    expect(result.resolvedIds).toEqual(["exc-1", "exc-2"]);

    // exc-1 and exc-2 should be approved
    expect(updated[0].reviewStatus).toBe("approved");
    expect(updated[1].reviewStatus).toBe("approved");
    // exc-3 (different type) untouched
    expect(updated[2].reviewStatus).toBe("open");
    // exc-4 (already approved) untouched
    expect(updated[3].reviewStatus).toBe("approved");

    expect(decisions).toHaveLength(2);
    expect(auditEntries).toHaveLength(2);
    for (const entry of auditEntries) {
      expect(entry.payload).toHaveProperty("bulkResolve", true);
    }
  });

  it("bulk-rejects with reject action", () => {
    const cards: ExceptionCard[] = [
      makeCard({ id: "exc-1", type: "route_conflict", reviewStatus: "open" }),
    ];

    const { cards: updated, result } = bulkResolve(
      cards,
      "route_conflict",
      "reject",
      "bob",
      "dispatcher",
      "Routes are fine",
    );

    expect(result.resolvedCount).toBe(1);
    expect(updated[0].reviewStatus).toBe("rejected");
    expect(updated[0].rejectionReason).toBe("Routes are fine");
  });

  it("returns zero when no matching open exceptions", () => {
    const cards: ExceptionCard[] = [
      makeCard({ id: "exc-1", type: "pricing_conflict", reviewStatus: "approved" }),
    ];

    const { result } = bulkResolve(cards, "pricing_conflict", "approve", "alice", "owner", "done");

    expect(result.resolvedCount).toBe(0);
    expect(result.resolvedIds).toEqual([]);
  });
});

// ─── audit trail ─────────────────────────────────────────────────────

describe("audit trail", () => {
  it("appends and retrieves audit entries by job", () => {
    const entry = {
      id: "aud-1",
      jobId: "job-1",
      action: "exception_approved",
      actor: "alice",
      at: "2026-08-12T00:00:00.000Z",
      reason: "Approved",
      payload: { exceptionId: "exc-1" },
    };

    appendAudit(entry);
    const jobAudit = getAuditForJob("job-1");
    expect(jobAudit).toHaveLength(1);
    expect(jobAudit[0].id).toBe("aud-1");
  });

  it("retrieves audit entries by exception ID", () => {
    appendAudit({
      id: "aud-1",
      jobId: "job-1",
      action: "exception_approved",
      actor: "alice",
      at: "2026-08-12T00:00:00.000Z",
      reason: "Approved",
      payload: { exceptionId: "exc-1" },
    });
    appendAudit({
      id: "aud-2",
      jobId: "job-1",
      action: "exception_rejected",
      actor: "bob",
      at: "2026-08-12T00:01:00.000Z",
      reason: "Wrong",
      payload: { exceptionId: "exc-2" },
    });

    const exc1Audit = getAuditForException("exc-1");
    expect(exc1Audit).toHaveLength(1);
    expect(exc1Audit[0].id).toBe("aud-1");
  });

  it("appends batch entries", () => {
    const entries = [
      { id: "aud-1", jobId: "job-1", action: "a", actor: "x", at: "t1", reason: "r", payload: {} },
      { id: "aud-2", jobId: "job-1", action: "b", actor: "y", at: "t2", reason: "r", payload: {} },
    ];

    appendAuditBatch(entries);
    expect(getAllAudit()).toHaveLength(2);
  });

  it("counts audit entries per job", () => {
    appendAudit({ id: "aud-1", jobId: "job-1", action: "a", actor: "x", at: "t1", reason: "r", payload: {} });
    appendAudit({ id: "aud-2", jobId: "job-2", action: "b", actor: "y", at: "t2", reason: "r", payload: {} });
    appendAudit({ id: "aud-3", jobId: "job-1", action: "c", actor: "z", at: "t3", reason: "r", payload: {} });

    expect(auditCountForJob("job-1")).toBe(2);
    expect(auditCountForJob("job-2")).toBe(1);
  });

  it("clearAudit empties the log", () => {
    appendAudit({ id: "aud-1", jobId: "job-1", action: "a", actor: "x", at: "t1", reason: "r", payload: {} });
    clearAudit();
    expect(getAllAudit()).toHaveLength(0);
  });
});

// ─── role gate ───────────────────────────────────────────────────────

describe("role gate", () => {
  it("owner can resolve pricing_conflict", () => {
    const card = makeCard({ type: "pricing_conflict" });
    expect(canResolve("owner", card)).toBe(true);
  });

  it("dispatcher cannot resolve pricing_conflict", () => {
    const card = makeCard({ type: "pricing_conflict" });
    expect(canResolve("dispatcher", card)).toBe(false);
  });

  it("dispatcher can resolve route_conflict", () => {
    const card = makeCard({ type: "route_conflict" });
    expect(canResolve("dispatcher", card)).toBe(true);
  });

  it("owner cannot resolve route_conflict", () => {
    const card = makeCard({ type: "route_conflict" });
    expect(canResolve("owner", card)).toBe(false);
  });

  it("admin can resolve any exception type", () => {
    expect(canResolve("admin", makeCard({ type: "pricing_conflict" }))).toBe(true);
    expect(canResolve("admin", makeCard({ type: "route_conflict" }))).toBe(true);
    expect(canResolve("admin", makeCard({ type: "orphan_container" }))).toBe(true);
  });

  it("any role can resolve non-gated types", () => {
    const card = makeCard({ type: "orphan_container" });
    expect(canResolve("owner", card)).toBe(true);
    expect(canResolve("dispatcher", card)).toBe(true);
    expect(canResolve("admin", card)).toBe(true);
  });

  it("canBulkResolve checks role against exception type", () => {
    expect(canBulkResolve("owner", "pricing_conflict")).toBe(true);
    expect(canBulkResolve("dispatcher", "pricing_conflict")).toBe(false);
    expect(canBulkResolve("dispatcher", "route_conflict")).toBe(true);
    expect(canBulkResolve("admin", "pricing_conflict")).toBe(true);
    expect(canBulkResolve("owner", "orphan_container")).toBe(true);
  });

  it("requiredRoleFor returns the gating role or null", () => {
    expect(requiredRoleFor("pricing_conflict")).toBe("owner");
    expect(requiredRoleFor("route_conflict")).toBe("dispatcher");
    expect(requiredRoleFor("orphan_container")).toBeNull();
  });

  it("denialReason explains why a role is denied", () => {
    const card = makeCard({ type: "pricing_conflict" });
    const reason = denialReason("dispatcher", card);
    expect(reason).toContain("dispatcher");
    expect(reason).toContain("pricing_conflict");
    expect(reason).toContain("owner");
  });
});

// ─── exception store ────────────────────────────────────────────────

describe("exception store", () => {
  it("stores and retrieves exceptions by job and ID", () => {
    const card = makeCard({ id: "exc-1", jobId: "job-1" });
    putException(card);

    const retrieved = getException("job-1", "exc-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe("exc-1");
  });

  it("returns undefined for missing exception", () => {
    expect(getException("job-1", "nonexistent")).toBeUndefined();
  });

  it("stores and retrieves multiple exceptions", () => {
    const cards: ExceptionCard[] = [
      makeCard({ id: "exc-1", jobId: "job-1" }),
      makeCard({ id: "exc-2", jobId: "job-1" }),
      makeCard({ id: "exc-3", jobId: "job-2" }),
    ];
    putExceptions(cards);

    const job1 = getExceptionsForJob("job-1");
    expect(job1).toHaveLength(2);

    const job2 = getExceptionsForJob("job-2");
    expect(job2).toHaveLength(1);
  });

  it("updates an exception in place", () => {
    const card = makeCard({ id: "exc-1", jobId: "job-1", reviewStatus: "open" });
    putException(card);

    const updated = { ...card, reviewStatus: "approved" as const };
    updateException(updated);

    const retrieved = getException("job-1", "exc-1");
    expect(retrieved!.reviewStatus).toBe("approved");
  });

  it("clearExceptionStore empties the store", () => {
    putException(makeCard());
    clearExceptionStore();
    expect(getExceptionsForJob("job-1")).toHaveLength(0);
  });
});

// ─── toExceptionCard ─────────────────────────────────────────────────

describe("toExceptionCard", () => {
  it("builds an ExceptionCard from an ExceptionIssue", () => {
    const issue = makeIssue();
    const card = toExceptionCard(issue, 0.85, "raw-042");

    expect(card.id).toBe("exc-001");
    expect(card.type).toBe("pricing_conflict");
    expect(card.confidence).toBe(0.85);
    expect(card.sourceRecord).toBe("raw-042");
    expect(card.reviewStatus).toBe("open");
  });
});

// ─── end-to-end: action + audit + store ──────────────────────────────

describe("end-to-end review flow", () => {
  it("approve -> audit recorded -> store updated", () => {
    const card = makeCard({ id: "exc-1", jobId: "job-1" });
    putException(card);

    const { card: updated, audit } = approveException(card, "alice", "owner", "commit", "Looks good");
    updateException(updated);
    appendAudit(audit);

    // Store reflects the change
    const stored = getException("job-1", "exc-1");
    expect(stored!.reviewStatus).toBe("approved");
    expect(stored!.reviewedBy).toBe("alice");

    // Audit trail is complete
    const trail = getAuditForJob("job-1");
    expect(trail).toHaveLength(1);
    expect(trail[0].action).toBe("exception_approved");
    expect(trail[0].actor).toBe("alice");
    expect(trail[0].reason).toBe("Looks good");
  });

  it("reject -> audit recorded -> store updated", () => {
    const card = makeCard({ id: "exc-2", jobId: "job-1" });
    putException(card);

    const { card: updated, audit } = rejectException(card, "bob", "dispatcher", "Not a real issue");
    updateException(updated);
    appendAudit(audit);

    const stored = getException("job-1", "exc-2");
    expect(stored!.reviewStatus).toBe("rejected");
    expect(stored!.rejectionReason).toBe("Not a real issue");

    const trail = getAuditForJob("job-1");
    expect(trail).toHaveLength(1);
    expect(trail[0].action).toBe("exception_rejected");
  });

  it("bulk-resolve -> all audit entries recorded -> all cards updated", () => {
    const cards: ExceptionCard[] = [
      makeCard({ id: "exc-1", jobId: "job-1", type: "pricing_conflict" }),
      makeCard({ id: "exc-2", jobId: "job-1", type: "pricing_conflict" }),
      makeCard({ id: "exc-3", jobId: "job-1", type: "orphan_container" }),
    ];
    putExceptions(cards);

    const { cards: updated, auditEntries, result } = bulkResolve(
      cards,
      "pricing_conflict",
      "approve",
      "alice",
      "owner",
      "All good",
    );

    putExceptions(updated);
    appendAuditBatch(auditEntries);

    expect(result.resolvedCount).toBe(2);

    // Pricing conflicts are approved
    expect(getException("job-1", "exc-1")!.reviewStatus).toBe("approved");
    expect(getException("job-1", "exc-2")!.reviewStatus).toBe("approved");
    // Orphan container untouched
    expect(getException("job-1", "exc-3")!.reviewStatus).toBe("open");

    // Two audit entries
    expect(auditCountForJob("job-1")).toBe(2);
  });
});
