/**
 * POST /api/jobs/[jobId]/exceptions/bulk-resolve
 *
 * Bulk-resolve all open exceptions of a given type with the same action.
 * Role-gated: owner resolves pricing, dispatcher resolves routes.
 */

import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/server/api/contracts";
import {
  bulkResolve,
  canBulkResolve,
  getExceptionsForJob,
  putExceptions,
  appendAuditBatch,
} from "@/features/review";
import type { BulkResolveRequest } from "@/features/review";
import { hydrateExceptionStore, persistExceptionCard } from "@/server/exception-sync";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  let body: BulkResolveRequest;
  try {
    body = (await request.json()) as BulkResolveRequest;
  } catch {
    return NextResponse.json(
      apiError("invalid_body", "Request body must be valid JSON"),
      { status: 400 },
    );
  }

  if (!body.exceptionType || !body.action || !body.actor || !body.role || !body.reason) {
    return NextResponse.json(
      apiError("missing_fields", "exceptionType, action, actor, role, and reason are required"),
      { status: 400 },
    );
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      apiError("invalid_action", "action must be 'approve' or 'reject'"),
      { status: 400 },
    );
  }

  if (!canBulkResolve(body.role, body.exceptionType)) {
    return NextResponse.json(
      apiError("forbidden", `Role "${body.role}" cannot bulk-resolve "${body.exceptionType}" exceptions`),
      { status: 403 },
    );
  }

  await hydrateExceptionStore(jobId);

  const cards = getExceptionsForJob(jobId);
  if (cards.length === 0) {
    return NextResponse.json(
      apiError("not_found", `No exceptions found for job ${jobId}`),
      { status: 404 },
    );
  }

  const { cards: updatedCards, auditEntries, result } = bulkResolve(
    cards,
    body.exceptionType,
    body.action,
    body.actor,
    body.role,
    body.reason,
  );

  putExceptions(updatedCards);
  appendAuditBatch(auditEntries);
  const resolvedIdSet = new Set(result.resolvedIds);
  await Promise.all(
    updatedCards.filter((card) => resolvedIdSet.has(card.id)).map((card) => persistExceptionCard(card)),
  );

  return NextResponse.json({
    resolvedCount: result.resolvedCount,
    exceptionType: result.exceptionType,
    action: result.action,
    resolvedIds: result.resolvedIds,
  });
}
