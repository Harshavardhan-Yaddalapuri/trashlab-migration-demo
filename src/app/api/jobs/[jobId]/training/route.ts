/**
 * GET /api/jobs/[jobId]/training
 *
 * Generate role-based training packets for a completed migration job.
 * Returns one packet per role (owner, dispatcher, driver, csr).
 * Uses LangChain LCEL when available, falls back to deterministic.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTrainingPackets, generateTrainingPacketsSync } from "@/features/training";
import type { TrainingInput } from "@/features/training";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<NextResponse> {
  const { jobId } = await params;

  // Build training input from demo targets
  const input: TrainingInput = {
    jobId,
    autoMapped: 148_800,
    exceptionCount: 1_200,
    totalRecords: 150_000,
    goLiveDays: 2,
    autoMapRate: 0.992,
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
