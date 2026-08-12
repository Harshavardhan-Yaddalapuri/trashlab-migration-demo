/**
 * POST /api/jobs/[jobId]/commit
 *
 * Commit a batch of approved mapping proposals. Idempotent: same
 * contentHash returns the existing batch. Creates a snapshot for
 * rollback support.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";
import {
  commitBatch,
  createCommitBatch,
  findExistingBatch,
  takeSnapshot,
} from "@/features/commit";
import {
  getBatchesForJob,
  getExceptions,
  getProposals,
  putBatch,
  putExceptions,
  putProposals,
  putSnapshot,
} from "@/server/stores";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  let body: { actor?: string };
  try {
    body = (await request.json()) as { actor?: string };
  } catch {
    return NextResponse.json(
      apiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  if (!body.actor) {
    return NextResponse.json(
      apiError("missing_fields", "actor is required"),
      { status: 400 },
    );
  }

  const proposals = getProposals(jobId);
  const exceptions = getExceptions(jobId);

  if (proposals.length === 0) {
    return NextResponse.json(
      apiError("not_found", `No proposals found for job ${jobId}`),
      { status: 404 },
    );
  }

  // Check for idempotent re-commit
  const batch = createCommitBatch(jobId, proposals, body.actor);
  const existing = findExistingBatch(getBatchesForJob(jobId), batch.contentHash);

  if (existing && existing.status === "committed") {
    return NextResponse.json({
      batchId: existing.id,
      status: existing.status,
      committedCount: existing.records.length,
      idempotent: true,
    });
  }

  // Take snapshot for rollback
  const snapshot = takeSnapshot(batch, proposals, exceptions);
  putSnapshot(snapshot);

  // Commit
  const { batch: committed, proposals: updatedProposals, exceptions: updatedExceptions, result } =
    commitBatch(batch, proposals, exceptions);

  putBatch(committed);
  putProposals(jobId, updatedProposals);
  putExceptions(jobId, updatedExceptions);

  return NextResponse.json({
    batchId: committed.id,
    status: committed.status,
    committedCount: result.committedCount,
    resolvedExceptions: result.resolvedExceptions,
    finalizedAt: committed.finalizedAt,
  });
}
