/**
 * GET /api/v1/migration-jobs/[jobId]/exceptions — list a job's exceptions.
 */

import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { exceptions } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const rows = await db
    .select()
    .from(exceptions)
    .where(eq(exceptions.jobId, jobId))
    .orderBy(asc(exceptions.createdAt));

  return NextResponse.json({
    exceptions: rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      summary: row.summary,
      evidence: row.evidence as string[],
      suggestedFix: row.suggestedFix,
      reviewStatus: row.reviewStatus,
      confidence: row.confidence,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })),
  });
}
