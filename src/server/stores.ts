/**
 * In-memory stores for commit batches, proposals, and snapshots.
 * In production these are Postgres tables. For the demo they are Maps.
 */

import type { MappingProposal, ExceptionIssue } from "@/lib/types";
import type { CommitBatch, CommitSnapshot } from "@/features/commit";

const batchStore = new Map<string, CommitBatch>();
const proposalStore = new Map<string, MappingProposal[]>();
const exceptionStore = new Map<string, ExceptionIssue[]>();
const snapshotStore = new Map<string, CommitSnapshot>();

// ─── Batches ──────────────────────────────────────────────────────────

export function putBatch(batch: CommitBatch): void {
  batchStore.set(batch.id, batch);
}

export function getBatch(batchId: string): CommitBatch | undefined {
  return batchStore.get(batchId);
}

export function getBatchesForJob(jobId: string): CommitBatch[] {
  return Array.from(batchStore.values()).filter((b) => b.jobId === jobId);
}

// ─── Proposals ────────────────────────────────────────────────────────

export function putProposals(jobId: string, proposals: MappingProposal[]): void {
  proposalStore.set(jobId, proposals);
}

export function getProposals(jobId: string): MappingProposal[] {
  return proposalStore.get(jobId) ?? [];
}

// ─── Exceptions ───────────────────────────────────────────────────────

export function putExceptions(jobId: string, exceptions: ExceptionIssue[]): void {
  exceptionStore.set(jobId, exceptions);
}

export function getExceptions(jobId: string): ExceptionIssue[] {
  return exceptionStore.get(jobId) ?? [];
}

// ─── Snapshots ────────────────────────────────────────────────────────

export function putSnapshot(snapshot: CommitSnapshot): void {
  snapshotStore.set(snapshot.batchId, snapshot);
}

export function getSnapshot(batchId: string): CommitSnapshot | undefined {
  return snapshotStore.get(batchId);
}

// ─── Clear (tests only) ───────────────────────────────────────────────

export function clearStores(): void {
  batchStore.clear();
  proposalStore.clear();
  exceptionStore.clear();
  snapshotStore.clear();
}
