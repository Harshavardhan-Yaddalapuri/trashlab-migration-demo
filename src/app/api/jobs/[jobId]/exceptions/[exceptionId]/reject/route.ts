/**
 * POST /api/jobs/[jobId]/exceptions/[exceptionId]/reject
 *
 * Reject an exception with a required reason.
 * Role-gated: owner rejects pricing, dispatcher rejects routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";
import {
  rejectException,
  canResolve,
  denialReason,
  getException,
  updateException,
  appendAudit,
} from "@/features/review";
import type { RejectRequest } from "@/features/review";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; exceptionId: string }> },
): Promise<NextResponse> {
  const { jobId, exceptionId } = await params;

  let body: RejectRequest;
  try {
    body = (await request.json()) as RejectRequest;
  } catch {
    return NextResponse.json(
      apiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  if (!body.actor || !body.role || !body.reason) {
    return NextResponse.json(
      apiError("missing_fields", "actor, role, and reason are required"),
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

  const { card: updatedCard, audit } = rejectException(
    card,
    body.actor,
    body.role,
    body.reason,
  );

  updateException(updatedCard);
  appendAudit(audit);

  return NextResponse.json({
    exception: {
      id: updatedCard.id,
      type: updatedCard.type,
      reviewStatus: updatedCard.reviewStatus,
      rejectionReason: updatedCard.rejectionReason,
      reviewedBy: updatedCard.reviewedBy,
      reviewedAt: updatedCard.reviewedAt,
    },
  });
}
