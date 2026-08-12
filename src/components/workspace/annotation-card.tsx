"use client";

/**
 * One real exception rendered in plain business language, with a real
 * suggested fix and Approve/Reject wired to the existing review endpoints.
 * No raw type codes shown to the user.
 */

import { useState } from "react";
import { approveException, rejectException } from "@/lib/api";
import type { EntityRecordException } from "@/lib/api";
import { describeExceptionType } from "@/components/workspace/entity-config";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-600",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-slate-200 bg-slate-50 text-slate-500",
};

const REVIEWER_ACTOR = "workspace-user";
const REVIEWER_ROLE = "admin" as const;

interface AnnotationCardProps {
  jobId: string;
  exception: EntityRecordException;
  onResolved?: () => void;
}

export function AnnotationCard({ jobId, exception, onResolved }: AnnotationCardProps) {
  const [status, setStatus] = useState(exception.reviewStatus);
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolved = status !== "open";
  const sev = SEVERITY_STYLES[exception.severity] ?? SEVERITY_STYLES.info;

  const handleApprove = async () => {
    setPending("approve");
    setError(null);
    const ok = await approveException(jobId, exception.id, REVIEWER_ACTOR, REVIEWER_ROLE);
    setPending(null);
    if (ok) {
      setStatus("approved");
      onResolved?.();
    } else {
      setError("Couldn't save that just now. Try again.");
    }
  };

  const handleReject = async () => {
    setPending("reject");
    setError(null);
    const ok = await rejectException(jobId, exception.id, REVIEWER_ACTOR, REVIEWER_ROLE, "Reviewed and dismissed");
    setPending(null);
    if (ok) {
      setStatus("rejected");
      onResolved?.();
    } else {
      setError("Couldn't save that just now. Try again.");
    }
  };

  return (
    <div className={`rounded-xl border p-4 ${resolved ? "border-[#10b981]/30 bg-[#10b981]/5" : "border-[#e0deff] bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev}`}>
            {describeExceptionType(exception.type)}
          </span>
          <p className="mt-2 text-sm text-slate-700">{exception.summary}</p>
          <p className="mt-1.5 text-xs text-[#6260af]">
            <span className="font-semibold">Suggested:</span> {exception.suggestedFix}
          </p>
        </div>
        {resolved ? (
          <span className="shrink-0 rounded-full bg-[#10b981]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#10b981]">
            {status}
          </span>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => void handleApprove()}
              disabled={pending !== null}
              className="rounded-full bg-[#312d97] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#5149d7] disabled:opacity-50"
            >
              {pending === "approve" ? "Saving..." : "Approve"}
            </button>
            <button
              onClick={() => void handleReject()}
              disabled={pending !== null}
              className="rounded-full border border-[#e0deff] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6260af] transition-colors hover:bg-[#f7f7ff] disabled:opacity-50"
            >
              {pending === "reject" ? "Saving..." : "Dismiss"}
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
