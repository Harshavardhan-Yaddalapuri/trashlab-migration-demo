"use client";

/**
 * The destination: your migrated data, alive inside a working preview of
 * the app. Real outcome banner (real report numbers, plain language) plus
 * real entity screens. No pipeline internals, no scripted fallback data --
 * a failed fetch shows a real error state with retry, not fabricated
 * numbers.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { formatCount } from "@/components/ui/format";
import { getJobReport } from "@/lib/api";
import type { JobReport } from "@/lib/api";
import { ENTITY_CONFIGS } from "@/components/workspace/entity-config";
import { EntityListView } from "@/components/workspace/entity-list-view";

type LoadState = "loading" | "ready" | "error";

export function WorkspaceView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const [report, setReport] = useState<JobReport | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [activeEntity, setActiveEntity] = useState(ENTITY_CONFIGS[0].entityType);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const fetchReport = async () => {
      const result = await getJobReport(jobId);
      if (cancelled) return;
      if (result === null) {
        setLoadState("error");
        return;
      }
      setReport(result);
      setLoadState("ready");
    };
    void fetchReport();
    return () => {
      cancelled = true;
    };
  }, [jobId, retryToken]);

  const retry = () => {
    setLoadState("loading");
    setRetryToken((t) => t + 1);
  };

  if (!jobId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="text-lg font-semibold text-slate-800">No migration data to show yet.</p>
        <p className="mt-2 text-sm text-slate-500">Connect a system to bring your data in.</p>
        <button
          onClick={() => router.push("/migrate")}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#312d97] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
        >
          Connect a system
        </button>
      </div>
    );
  }

  const activeConfig = ENTITY_CONFIGS.find((c) => c.entityType === activeEntity) ?? ENTITY_CONFIGS[0];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel="Your Workspace"
        status={loadState === "ready" ? { label: "synced", active: false } : undefined}
        right={
          <button
            onClick={() => router.push("/migrate")}
            className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20"
          >
            Connect another system
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {loadState === "loading" && (
            <div className="mb-8 rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-6 text-center text-sm text-[#6260af]">
              Loading your migration summary...
            </div>
          )}

          {loadState === "error" && (
            <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-sm text-red-600">Couldn&apos;t load your migration summary right now.</p>
              <button
                onClick={retry}
                className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {report && (
            <div className="mb-8 rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 p-6">
              <p className="text-lg font-bold text-[#1a174f]">
                {formatCount(report.totalRecords)} records moved clean.
              </p>
              <div className="mt-3 flex flex-wrap gap-6">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Go-live</span>
                  <p className="font-mono text-lg font-bold text-[#10b981]">{report.goLiveDays} days</p>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Needs your attention</span>
                  <p className="font-mono text-lg font-bold text-[#1a174f]">{formatCount(report.exceptionCount)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-6 flex gap-2">
            {ENTITY_CONFIGS.map((cfg) => (
              <button
                key={cfg.entityType}
                onClick={() => setActiveEntity(cfg.entityType)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeEntity === cfg.entityType
                    ? "bg-[#312d97] text-white"
                    : "border border-[#e0deff] text-[#6260af] hover:bg-[#f7f7ff]"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <EntityListView key={activeConfig.entityType} jobId={jobId} config={activeConfig} />
        </div>
      </main>
    </div>
  );
}
