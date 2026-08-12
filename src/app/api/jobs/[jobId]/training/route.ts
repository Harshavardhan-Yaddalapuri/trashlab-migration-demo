/**
 * GET /api/jobs/[jobId]/training
 *
 * Generate role-based training packets for a migration job, computed from
 * the job's real persisted pipeline output. Returns one packet per role
 * (owner, dispatcher, driver, csr). Uses LangChain LCEL when available,
 * falls back to deterministic.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTrainingPackets, generateTrainingPacketsSync } from "@/features/training";
import type { TrainingInput } from "@/features/training";
import { apiError } from "@/server/api/contracts";
import { buildReportInput } from "@/server/report-data";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  const reportInput = await buildReportInput(jobId);
  if (reportInput === null) {
    return NextResponse.json(
      apiError("no_data", `Job ${jobId} has no pipeline output yet`),
      { status: 404 },
    );
  }

  const input: TrainingInput = {
    jobId,
    autoMapped: reportInput.autoMapped,
    exceptionCount: reportInput.exceptionCount,
    totalRecords: reportInput.totalRecords,
    goLiveDays: reportInput.goLiveDays,
    autoMapRate: reportInput.totalRecords === 0 ? 0 : reportInput.autoMapped / reportInput.totalRecords,
  };

  let result;
  try {
    result = await generateTrainingPackets(input);
  } catch {
    // LLM failed, fall back to deterministic
    result = generateTrainingPacketsSync(input);
  }

  return NextResponse.json({
    jobId,
    generatedBy: result.generatedBy,
    packets: result.packets.map((p) => ({
      role: p.role,
      title: p.title,
      sections: p.sections,
      generatedAt: p.generatedAt,
      generatedBy: p.generatedBy,
    })),
  });
}
