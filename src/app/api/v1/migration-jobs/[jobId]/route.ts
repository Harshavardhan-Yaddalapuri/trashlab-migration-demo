/**
 * GET /api/v1/migration-jobs/[jobId] — get one job, its source files, and progress.
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { apiError, withApiErrorHandling } from "@/server/api/contracts";
import { db } from "@/server/db/client";
import { migrationJobs, sourceFiles } from "@/server/db/schema";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  return withApiErrorHandling("GET /api/v1/migration-jobs/[jobId]", async () => {
    const { jobId } = await params;

    if (!UUID_RE.test(jobId)) {
      return NextResponse.json(apiError("not_found", `Job ${jobId} not found`), { status: 404 });
    }

    const [job] = await db.select().from(migrationJobs).where(eq(migrationJobs.id, jobId)).limit(1);

    if (!job) {
      return NextResponse.json(apiError("not_found", `Job ${jobId} not found`), { status: 404 });
    }

    const files = await db.select().from(sourceFiles).where(eq(sourceFiles.jobId, jobId));

    return NextResponse.json({
      job: {
        id: job.id,
        tenantId: job.tenantId,
        status: job.status,
        progress: job.progress,
        stageProgress: job.stageProgress,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        sourceFiles: files.map((file) => ({
          id: file.id,
          kind: file.kind,
          fileName: file.fileName,
          recordCount: file.recordCount,
          rawHash: file.rawHash,
          ingestedAt: file.ingestedAt,
        })),
      },
    });
  });
}
