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
 * No em-dashes in user-facing text.
 */

import { useDemoStore } from "@/components/demo/demo-store";
import { formatCount, formatPercent } from "@/components/ui/format";
import { config } from "@/lib/config";

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
  const reset = useDemoStore((s) => s.reset);
  const totalRecords = config.demo.totalRecords;
  const autoMapped = 148_800;
  const exceptions = 1_200;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            TrashLab Migration Cockpit
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-500">
            Migration Complete
          </span>
        </div>
        <button
          onClick={reset}
          className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 transition-colors hover:text-zinc-400"
        >
          Run Again
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          {/* Headline metrics */}
          <div className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-800/60 bg-zinc-800/60 lg:grid-cols-4">
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Go-Live</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-400">2</p>
              <p className="font-mono text-[10px] text-zinc-600">days</p>
            </div>
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Auto-Mapped</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-emerald-400">99.2%</p>
              <p className="font-mono text-[10px] text-zinc-600">{formatCount(autoMapped)} of {formatCount(totalRecords)}</p>
            </div>
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Silent Errors</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-zinc-100">0</p>
              <p className="font-mono text-[10px] text-zinc-600">detected by eval gate</p>
            </div>
            <div className="bg-zinc-950 px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Exceptions</p>
              <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-amber-400">{formatCount(exceptions)}</p>
              <p className="font-mono text-[10px] text-zinc-600">all resolved</p>
            </div>
          </div>

          {/* Confidence histogram */}
          <section className="mb-8">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Confidence Distribution
            </h2>
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-6">
              <div className="flex items-end gap-1 h-32">
                {HISTOGRAM.map((bucket, i) => {
                  const maxCount = Math.max(...HISTOGRAM.map((b) => b.count));
                  const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                  return (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex-1 flex items-end">
                        <div
                          className="w-full rounded-t bg-emerald-500/30 transition-all duration-500"
                          style={{ height: `${heightPct}%` }}
                          title={`${bucket.lower.toFixed(1)}-${(bucket.lower + 0.1).toFixed(1)}: ${formatCount(bucket.count)}`}
                        />
                      </div>
                      <span className="font-mono text-[8px] tabular-nums text-zinc-700">
                        {bucket.lower.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">High (0.9+)</span>
                    <p className="font-mono text-sm tabular-nums text-emerald-400">{formatCount(136_500)}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Medium (0.7-0.9)</span>
                    <p className="font-mono text-sm tabular-nums text-amber-400">{formatCount(11_800)}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Low (0.0-0.7)</span>
                    <p className="font-mono text-sm tabular-nums text-red-400">{formatCount(1_700)}</p>
                  </div>
                </div>
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">Mean</span>
                  <p className="font-mono text-sm tabular-nums text-zinc-100">0.94</p>
                </div>
              </div>
            </div>
          </section>

          {/* Two-column: source + entity breakdowns */}
          <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Source breakdown */}
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                By Source System
              </h2>
              <div className="overflow-hidden rounded-lg border border-zinc-800/60">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-600">Source</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Total</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Auto</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Exc.</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SOURCE_BREAKDOWN.map((s) => (
                      <tr key={s.source} className="border-b border-zinc-800/40 last:border-0">
                        <td className="px-3 py-2.5 text-xs text-zinc-200">{s.source}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">{formatCount(s.total)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-400">{formatCount(s.autoMapped)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-amber-400">{formatCount(s.exceptions)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">{formatPercent(s.autoMapped / s.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Entity breakdown */}
            <section>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                By Entity Type
              </h2>
              <div className="overflow-hidden rounded-lg border border-zinc-800/60">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/60">
                      <th className="px-3 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-600">Entity</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Total</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Auto</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Exc.</th>
                      <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Conf.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ENTITY_BREAKDOWN.map((e) => (
                      <tr key={e.type} className="border-b border-zinc-800/40 last:border-0">
                        <td className="px-3 py-2.5 text-xs text-zinc-200">{e.type}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">{formatCount(e.total)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-emerald-400">{formatCount(e.autoMapped)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-amber-400">{formatCount(e.exceptions)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">{e.confidence.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Training packets */}
          <section className="mb-8">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Training Packets Ready
            </h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {TRAINING_ROLES.map((t) => (
                <div key={t.role} className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 font-mono text-sm font-bold text-emerald-400">
                      {t.icon}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">{t.role}</span>
                  </div>
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-emerald-400">
                    Generated
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-600">
                    Plain language, 4 sections each
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Audit trail */}
          <section className="mb-8">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Audit Trail Complete
            </h2>
            <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-4">
              <div className="flex flex-wrap gap-2">
                {AUDIT_EVENTS.map((event) => (
                  <span
                    key={event}
                    className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/50 px-2.5 py-1 font-mono text-[10px] text-zinc-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                    {event}
                  </span>
                ))}
              </div>
              <p className="mt-4 font-mono text-[10px] text-zinc-600">
                Every action logged. Full event-sourced history. Replayable from checkpoint.
              </p>
            </div>
          </section>

          {/* The ask */}
          <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <p className="text-xl font-bold leading-tight text-zinc-100">
              I ran 15 agents to build this overnight.
            </p>
            <p className="mt-2 text-xl font-bold leading-tight text-emerald-400">
              Imagine what I would do with yours.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}