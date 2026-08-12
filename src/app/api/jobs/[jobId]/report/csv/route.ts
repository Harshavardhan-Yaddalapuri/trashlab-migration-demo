/**
 * GET /api/jobs/[jobId]/report/csv
 *
 * Export the full migration report as a multi-section CSV file.
 * Content-Type: text/csv with Content-Disposition for download.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeReport, fullReportCsv } from "@/features/report";
import { apiError } from "@/server/api/contracts";
import { buildReportInput } from "@/server/report-data";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const input = await buildReportInput(jobId);
  if (input === null) {
    return NextResponse.json(
      apiError("no_data", `Job ${jobId} has no pipeline output yet`),
      { status: 404 },
    );
  }

  const report = computeReport(input);
  const csv = fullReportCsv(report);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="migration-report-${jobId}.csv"`,
    },
  });
}
