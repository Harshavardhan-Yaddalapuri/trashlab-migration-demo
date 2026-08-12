/**
 * GET /api/v1/migration-jobs/[jobId]/audit — list a job's real audit trail.
 */

import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.jobId, jobId))
    .orderBy(asc(auditEvents.at));

  return NextResponse.json({
    events: rows.map((row) => ({
      id: row.id,
      type: row.type,
      actor: row.actor,
      payload: row.payload,
      at: row.at,
    })),
  });
}
