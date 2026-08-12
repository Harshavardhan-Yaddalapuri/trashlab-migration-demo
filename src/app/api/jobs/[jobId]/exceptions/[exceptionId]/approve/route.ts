/**
 * POST /api/jobs/[jobId]/exceptions/[exceptionId]/approve
 *
 * Approve an exception. Supports draft (record intent) and commit (finalize).
 * Idempotent: re-approving an already-approved exception returns 200 with the
 * same card. Role-gated: owner approves pricing, dispatcher approves routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";
import {
  approveException,
  canResolve,
  denialReason,
  getException,
  updateException,
  appendAudit,
} from "@/features/review";
import type { ApproveRequest } from "@/features/review";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; exceptionId: string }> },
): Promise<NextResponse> {
  const { jobId, exceptionId } = await params;

  let body: ApproveRequest;
  try {
    body = (await request.json()) as ApproveRequest;
  } catch {
    return NextResponse.json(
      apiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  if (!body.actor || !body.role) {
    return NextResponse.json(
      apiError("missing_fields", "actor and role are required"),
      { status: 400 },
    );
  }

  if (body.mode !== "draft" && body.mode !== "commit") {
    return NextResponse.json(
      apiError("invalid_mode", "mode must be 'draft' or 'commit'"),
      { status: 400 },
    );
  }

  const card = getException(jobId, exceptionId);
  if (!card) {
    return NextResponse.json(
      apiError("not_found", `Exception ${exceptionId} not found in job ${jobId}`),
      { status: 404 },
    );
  }

  if (!canResolve(body.role, card)) {
    return NextResponse.json(
      apiError("forbidden", denialReason(body.role, card)),
      { status: 403 },
    );
  }

  const { card: updatedCard, audit } = approveException(
    card,
    body.actor,
    body.role,
    body.mode,
    body.reason,
  );

  updateException(updatedCard);
  appendAudit(audit);

  return NextResponse.json({
    exception: {
      id: updatedCard.id,
      type: updatedCard.type,
      reviewStatus: updatedCard.reviewStatus,
      reviewedBy: updatedCard.reviewedBy,
      reviewedAt: updatedCard.reviewedAt,
    },
    mode: body.mode,
  });
}
