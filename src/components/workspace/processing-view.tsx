"use client";

/**
 * The one moment between "connect" and "your data is in the app": a brief,
 * outcome-level status while the real pipeline runs. No stage names, no
 * per-second throughput -- just plain language, derived from the real
 * stageProgress the pipeline streams back. Redirects into /workspace once
 * the job reaches a terminal state.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getMigrationJob } from "@/lib/api";
import type { StageId } from "@/lib/api";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

const STAGE_ORDER: StageId[] = ["intake", "normalize", "resolve", "map", "validate", "review", "commit"];

const STAGE_MESSAGES: Record<StageId, string> = {
  intake: "Reading your files...",
  normalize: "Cleaning up your data...",
  resolve: "Matching your customers...",
  map: "Mapping your services...",
  validate: "Checking everything lines up...",
  review: "Almost there...",
  commit: "Finishing up...",
};

export function ProcessingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const [message, setMessage] = useState(STAGE_MESSAGES.intake);
  const [failedToStart, setFailedToStart] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let misses = 0;

    const poll = async () => {
      const job = await getMigrationJob(jobId);
      if (cancelled) return;

      if (job === null) {
        misses += 1;
        if (misses >= 5) {
          setFailedToStart(true);
          return;
        }
        timer = setTimeout(poll, 1500);
        return;
      }
      misses = 0;

      if (job.stageProgress) {
        const current = STAGE_ORDER.find((id) => job.stageProgress![id].phase !== "done");
        if (current) setMessage(STAGE_MESSAGES[current]);
      }

      if (TERMINAL_STATUSES.has(job.status)) {
        router.push(`/workspace?job=${jobId}`);
        return;
      }
      timer = setTimeout(poll, 1500);
    };
    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, router]);

  if (!jobId || failedToStart) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-lg font-semibold text-slate-800">Something went wrong bringing your data in.</p>
        <p className="mt-2 text-sm text-slate-500">Let&apos;s try connecting again.</p>
        <button
          onClick={() => router.push("/migrate")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#312d97] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
        >
          Back to connect
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-6 h-10 w-10 animate-spin rounded-full border-4 border-[#e0deff] border-t-[#312d97]" aria-hidden />
      <p className="text-lg font-semibold text-[#1a174f]">{message}</p>
      <p className="mt-2 text-sm text-slate-500">This usually takes a few moments.</p>
    </div>
  );
}
