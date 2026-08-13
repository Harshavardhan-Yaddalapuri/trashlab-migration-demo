/**
 * GET /api/jobs/[jobId]/report
 *
 * Generate the migration completion report with metrics, breakdowns,
 * and confidence histogram — computed from the job's real persisted
 * pipeline output.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeReport } from "@/features/report";
import { apiError, withApiErrorHandling } from "@/server/api/contracts";
import { buildReportInput } from "@/server/report-data";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  return withApiErrorHandling("GET /api/jobs/[jobId]/report", async () => {
    const { jobId } = await params;

    const input = await buildReportInput(jobId);
    if (input === null) {
      return NextResponse.json(
        apiError("no_data", `Job ${jobId} has no pipeline output yet`),
        { status: 404 },
      );
    }

    const report = computeReport(input);

    return NextResponse.json({
      jobId: report.jobId,
      generatedAt: report.generatedAt,
      totalRecords: report.totalRecords,
      autoMapped: report.autoMapped,
      exceptionCount: report.exceptionCount,
      autoMapRate: report.autoMapRate,
      exceptionRate: report.exceptionRate,
      silentErrors: report.silentErrors,
      goLiveDays: report.goLiveDays,
      confidenceHistogram: report.confidenceHistogram,
      bySource: report.bySource,
      byEntity: report.byEntity,
    });
  });
}
