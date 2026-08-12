"use client";

/**
 * Report view. The final demo screen. Shows:
 * - 2 days to go-live
 * - 99.2% auto-mapped
 * - 0 silent errors
 * - Confidence histogram
 * - Per-role training packets ready
 * - Audit complete
 * - Per-source and per-entity breakdowns
 *
 * Light theme, TrashLab design language, shared header with back nav.
 * No em-dashes in user-facing text.
 */

import { useEffect, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { formatCount, formatPercent } from "@/components/ui/format";
import { config } from "@/lib/config";
import { useRouter, useSearchParams } from "next/navigation";
import { getJobReport } from "@/lib/api";
import type { JobReport } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  "routepro-csv": "RoutePro CSV",
  "quickbooks-export": "QuickBooks",
  "transfer-spreadsheet": "Transfer Station",
  "legacy-export": "Legacy Export",
};

const ENTITY_LABELS: Record<string, string> = {
  customer: "Customers",
  site: "Sites",
  container: "Containers",
  agreement: "Agreements",
  route: "Routes",
  ticket: "Scale Tickets",
};

function confidenceBand(histogram: JobReport["confidenceHistogram"], from: number, to: number): number {
  return histogram.slice(from, to).reduce((sum, b) => sum + b.count, 0);
}

/** Histogram data matching the full batch. */
const HISTOGRAM = [
  { lower: 0.0, count: 850 },
  { lower: 0.1, count: 420 },
  { lower: 0.2, count: 180 },
  { lower: 0.3, count: 250 },
  { lower: 0.4, count: 0 },
  { lower: 0.5, count: 0 },
  { lower: 0.6, count: 0 },
  { lower: 0.7, count: 3_200 },
  { lower: 0.8, count: 8_600 },
  { lower: 0.9, count: 136_500 },
];

const SOURCE_BREAKDOWN = [
  { source: "RoutePro CSV", total: 78_000, autoMapped: 77_280, exceptions: 720 },
  { source: "QuickBooks", total: 45_000, autoMapped: 44_640, exceptions: 360 },
  { source: "Transfer Station", total: 20_000, autoMapped: 19_840, exceptions: 160 },
  { source: "Legacy Export", total: 7_000, autoMapped: 6_930, exceptions: 70 },
];

const ENTITY_BREAKDOWN = [
  { type: "Customers", total: 45_000, autoMapped: 44_640, exceptions: 360, confidence: 0.95 },
  { type: "Sites", total: 35_000, autoMapped: 34_720, exceptions: 280, confidence: 0.93 },
  { type: "Containers", total: 40_000, autoMapped: 39_700, exceptions: 300, confidence: 0.94 },
  { type: "Agreements", total: 18_000, autoMapped: 17_820, exceptions: 180, confidence: 0.92 },
  { type: "Routes", total: 7_000, autoMapped: 7_000, exceptions: 0, confidence: 0.99 },
  { type: "Scale Tickets", total: 5_000, autoMapped: 5_000, exceptions: 0, confidence: 0.97 },
];

const TRAINING_ROLES = [
  { role: "Business Owner", icon: "O" },
  { role: "Dispatcher", icon: "D" },
  { role: "Driver", icon: "V" },
  { role: "Customer Service", icon: "C" },
];

const AUDIT_EVENTS = [
  "JobCreated",
  "SourceParsed",
  "RecordNormalized",
  "CustomerResolved",
  "CustomerAutoMerged",
  "MappingProposed",
  "MappingCommitted",
  "ExceptionRaised",
  "ExceptionApproved",
  "ExceptionBulkResolved",
  "TrainingPacketGenerated",
  "JobCompleted",
];

export function ReportView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const reset = useDemoStore((s) => s.reset);
  const [realReport, setRealReport] = useState<JobReport | null>(null);

  // Real report: fetched once when a real jobId is present. Falls back to
  // the scripted demo numbers if the API is unreachable or there is no
  // real job.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    void getJobReport(jobId).then((r) => {
      if (!cancelled) setRealReport(r);
    });
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const totalRecords = realReport ? realReport.totalRecords : config.demo.totalRecords;
  const autoMapped = realReport ? realReport.autoMapped : 148_800;
  const exceptions = realReport ? realReport.exceptionCount : 1_200;
  const autoMapRate = realReport ? realReport.autoMapRate : 0.992;
  const silentErrors = realReport ? realReport.silentErrors : 0;
  const goLiveDays = realReport ? realReport.goLiveDays : 2;

  const histogram = realReport
    ? realReport.confidenceHistogram.map((b, i) => ({ lower: i * 0.1, count: b.count }))
    : HISTOGRAM;
  const highConfidence = realReport ? confidenceBand(realReport.confidenceHistogram, 9, 10) : 136_500;
  const mediumConfidence = realReport ? confidenceBand(realReport.confidenceHistogram, 7, 9) : 11_800;
  const lowConfidence = realReport ? confidenceBand(realReport.confidenceHistogram, 0, 7) : 1_700;
  const meanConfidence = realReport
    ? (() => {
        const total = realReport.confidenceHistogram.reduce((sum, b) => sum + b.count, 0);
        if (total === 0) return 0;
        const weighted = realReport.confidenceHistogram.reduce((sum, b, i) => sum + (i * 0.1 + 0.05) * b.count, 0);
        return weighted / total;
      })()
    : 0.94;

  const sourceBreakdown = realReport
    ? realReport.bySource.map((s) => ({
        source: SOURCE_LABELS[s.source] ?? s.source,
        total: s.totalRecords,
        autoMapped: s.autoMapped,
        exceptions: s.exceptions,
      }))
    : SOURCE_BREAKDOWN;
  const entityBreakdown = realReport
    ? realReport.byEntity.map((e) => ({
        type: ENTITY_LABELS[e.entityType] ?? e.entityType,
        total: e.totalRecords,
        autoMapped: e.autoMapped,
        exceptions: e.exceptions,
        confidence: e.avgConfidence,
      }))
    : ENTITY_BREAKDOWN;

  const runAgain = () => {
    reset();
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel="Migration Complete"
        status={{ label: "done", active: false }}
        right={
          <button
            onClick={runAgain}
            className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/20"
          >
            Run Again
          </button>
        }
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Headline metrics */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Go-Live</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">{goLiveDays}</p>
              <p className="text-[10px] font-medium text-[#6260af]">days</p>
            </div>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Auto-Mapped</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#10b981]">{formatPercent(autoMapRate)}</p>
              <p className="text-[10px] font-medium text-[#6260af]">{formatCount(autoMapped)} of {formatCount(totalRecords)}</p>
            </div>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Silent Errors</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#1a174f]">{silentErrors}</p>
              <p className="text-[10px] font-medium text-[#6260af]">detected by eval gate</p>
            </div>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] px-6 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">Exceptions</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums text-[#1a174f]">{formatCount(exceptions)}</p>
              <p className="text-[10px] font-medium text-[#6260af]">all resolved</p>
            </div>
          </div>

          {/* Confidence histogram */}
          <section className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Confidence Distribution
            </h2>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-6">
              <div className="flex items-end gap-1 h-32">
                {histogram.map((bucket, i) => {
                  const maxCount = Math.max(...histogram.map((b) => b.count));
                  const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex-1 flex items-end">
                        <div
                          className="w-full rounded-t bg-[#10a6cc]/40 transition-all duration-500"
                          style={{ height: `${heightPct}%` }}
                          title={`${bucket.lower.toFixed(1)}-${(bucket.lower + 0.1).toFixed(1)}: ${formatCount(bucket.count)}`}
                        />
                      </div>
                      <span className="font-mono text-[8px] tabular-nums text-[#6260af]">
                        {bucket.lower.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">High (0.9+)</span>
                    <p className="font-mono text-sm tabular-nums text-[#10b981]">{formatCount(highConfidence)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Medium (0.7-0.9)</span>
                    <p className="font-mono text-sm tabular-nums text-amber-600">{formatCount(mediumConfidence)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Low (0.0-0.7)</span>
                    <p className="font-mono text-sm tabular-nums text-red-500">{formatCount(lowConfidence)}</p>
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Mean</span>
                  <p className="font-mono text-sm tabular-nums text-slate-800">{meanConfidence.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Two-column: source + entity breakdowns */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Source breakdown */}
            <section>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
                By Source System
              </h2>
              <div className="overflow-hidden rounded-2xl border border-[#e0deff]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e0deff] bg-[#f7f7ff]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Source</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Total</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Auto</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Exc.</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceBreakdown.map((s) => (
                      <tr key={s.source} className="border-b border-[#e0deff] last:border-0">
                        <td className="px-3 py-2.5 text-xs text-slate-700">{s.source}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{formatCount(s.total)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-[#10b981]">{formatCount(s.autoMapped)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-amber-600">{formatCount(s.exceptions)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{formatPercent(s.total === 0 ? 0 : s.autoMapped / s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Entity breakdown */}
            <section>
              <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
                By Entity Type
              </h2>
              <div className="overflow-hidden rounded-2xl border border-[#e0deff]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#e0deff] bg-[#f7f7ff]">
                      <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Entity</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Total</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Auto</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Exc.</th>
                      <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entityBreakdown.map((e) => (
                      <tr key={e.type} className="border-b border-[#e0deff] last:border-0">
                        <td className="px-3 py-2.5 text-xs text-slate-700">{e.type}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{formatCount(e.total)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-[#10b981]">{formatCount(e.autoMapped)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-amber-600">{formatCount(e.exceptions)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-slate-600">{e.confidence.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Training packets */}
          <section className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Training Packets Ready
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {TRAINING_ROLES.map((t) => (
                <div key={t.role} className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#10b981]/15 font-mono text-sm font-bold text-[#10b981]">
                      {t.icon}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">{t.role}</span>
                  </div>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-[#10b981]">
                    Generated
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-[#6260af]">
                    Plain language, 4 sections each
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Audit trail */}
          <section className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Audit Trail Complete
            </h2>
            <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-4">
              <div className="flex flex-wrap gap-2">
                {AUDIT_EVENTS.map((event) => (
                  <span
                    key={event}
                    className="flex items-center gap-1.5 rounded-full border border-[#e0deff] bg-white px-2.5 py-1 font-mono text-[10px] text-slate-600"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" aria-hidden />
                    {event}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[10px] font-medium text-[#6260af]">
                Every action logged. Full event-sourced history. Replayable from checkpoint.
              </p>
            </div>
          </section>

          {/* The ask */}
          <section className="rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 p-8 text-center">
            <p className="text-xl font-bold leading-tight text-[#1a174f]">
              I ran 15 agents to build this overnight.
            </p>
            <p className="mt-2 text-xl font-bold leading-tight text-[#10b981]">
              Imagine what I would do with yours.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
