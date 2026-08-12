/**
 * GET /api/jobs/[jobId]/report/csv
 *
 * Export the full migration report as a multi-section CSV file.
 * Content-Type: text/csv with Content-Disposition for download.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeReport, fullReportCsv } from "@/features/report";
import type { ReportInput } from "@/features/report";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const input: ReportInput = {
    jobId,
    totalRecords: 150_000,
    autoMapped: 148_800,
    exceptionCount: 1_200,
    silentErrors: 0,
    goLiveDays: 2,
    confidences: Array(148_800).fill(0.95).concat(Array(1_200).fill(0.5)),
    sources: [
      { source: "routepro-csv", totalRecords: 60_000, autoMapped: 59_500, exceptions: 500 },
      { source: "quickbooks-export", totalRecords: 40_000, autoMapped: 39_700, exceptions: 300 },
      { source: "transfer-spreadsheet", totalRecords: 30_000, autoMapped: 29_800, exceptions: 200 },
      { source: "legacy-export", totalRecords: 20_000, autoMapped: 19_800, exceptions: 200 },
    ],
    entities: [
      { entityType: "customer", totalRecords: 45_000, autoMapped: 44_600, exceptions: 400, confidenceSum: 42_750, confidenceCount: 45_000 },
      { entityType: "site", totalRecords: 35_000, autoMapped: 34_700, exceptions: 300, confidenceSum: 33_250, confidenceCount: 35_000 },
      { entityType: "container", totalRecords: 40_000, autoMapped: 39_700, exceptions: 300, confidenceSum: 38_000, confidenceCount: 40_000 },
      { entityType: "agreement", totalRecords: 18_000, autoMapped: 17_800, exceptions: 200, confidenceSum: 17_100, confidenceCount: 18_000 },
      { entityType: "route", totalRecords: 7_000, autoMapped: 7_000, exceptions: 0, confidenceSum: 6_650, confidenceCount: 7_000 },
      { entityType: "ticket", totalRecords: 5_000, autoMapped: 5_000, exceptions: 0, confidenceSum: 4_750, confidenceCount: 5_000 },
    ],
  };

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
