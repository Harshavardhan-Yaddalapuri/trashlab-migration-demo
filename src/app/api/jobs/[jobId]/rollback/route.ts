/**
 * POST /api/jobs/[jobId]/rollback
 *
 * Roll back a committed batch. Restores proposals and exceptions
 * to their pre-commit state. Idempotent: rolling back an already-
 * rolled-back batch returns the same result.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";
import { rollbackBatch } from "@/features/commit";
import {
  getBatch,
  getExceptions,
  getProposals,
  getSnapshot,
  putBatch,
  putExceptions,
  putProposals,
} from "@/server/stores";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  let body: { batchId?: string };
  try {
    body = (await request.json()) as { batchId?: string };
  } catch {
    return NextResponse.json(
      apiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  if (!body.batchId) {
    return NextResponse.json(
      apiError("missing_fields", "batchId is required"),
      { status: 400 },
    );
  }

  const batch = getBatch(body.batchId);
  if (!batch) {
    return NextResponse.json(
      apiError("not_found", `Batch ${body.batchId} not found`),
      { status: 404 },
    );
  }

  if (batch.jobId !== jobId) {
    return NextResponse.json(
      apiError("invalid_request", `Batch ${body.batchId} does not belong to job ${jobId}`),
      { status: 400 },
    );
  }

  if (batch.status === "rolled_back") {
    return NextResponse.json({
      batchId: batch.id,
      status: batch.status,
      rolledBackCount: batch.records.length,
      idempotent: true,
    });
  }

  const snapshot = getSnapshot(body.batchId);
  if (!snapshot) {
    return NextResponse.json(
      apiError("not_found", `Snapshot for batch ${body.batchId} not found`),
      { status: 404 },
    );
  }

  const proposals = getProposals(jobId);
  const exceptions = getExceptions(jobId);

  const { batch: rolledBack, proposals: restoredProposals, exceptions: restoredExceptions, result } =
    rollbackBatch(batch, proposals, exceptions, snapshot);

  putBatch(rolledBack);
  putProposals(jobId, restoredProposals);
  putExceptions(jobId, restoredExceptions);

  return NextResponse.json({
    batchId: rolledBack.id,
    status: rolledBack.status,
    rolledBackCount: result.rolledBackCount,
    reopenedExceptions: result.reopenedExceptions,
    finalizedAt: rolledBack.finalizedAt,
  });
}
