"use client";

/**
 * File-drop simulation view. Shows 4 source files being dropped
 * into the pipeline. Each file "arrives" with a staggered animation,
 * then the fleet wakes up. User clicks to advance to live-sample.
 *
 * No em-dashes in user-facing text.
 */

import { useEffect, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { formatCount } from "@/components/ui/format";

interface DropFile {
  name: string;
  kind: string;
  records: number;
  delay: number;
}

const FILES: DropFile[] = [
  { name: "routepro_2019_export.csv", kind: "RoutePro CSV", records: 78_000, delay: 0 },
  { name: "quickbooks_customer_export.tsv", kind: "QuickBooks", records: 45_000, delay: 400 },
  { name: "transfer_station_weights.xlsx", kind: "Transfer Station", records: 20_000, delay: 800 },
  { name: "legacy_paper_export.tab", kind: "Legacy Export", records: 7_000, delay: 1200 },
];

export function FileDropView() {
  const advance = useDemoStore((s) => s.advance);
  const [droppedCount, setDroppedCount] = useState(0);
  const [allDropped, setAllDropped] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    FILES.forEach((file, i) => {
      const t = setTimeout(() => {
        setDroppedCount(i + 1);
        if (i === FILES.length - 1) {
          setAllDropped(true);
        }
      }, file.delay);
      timers.push(t);
    });
    return () => timers.forEach(clearTimeout);
  }, []);

  const totalRecords = FILES.reduce((sum, f) => sum + f.records, 0);

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight">
            TrashLab Migration Cockpit
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            File Drop
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500 cockpit-pulse" aria-hidden />
          <span className="font-mono text-[10px] uppercase tracking-wider text-amber-400">
            ingesting
          </span>
        </div>
      </header>

      {/* Drop zone */}
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="w-full max-w-3xl">
          {/* Drop target */}
          <div
            className={`mb-8 rounded-xl border-2 border-dashed p-12 text-center transition-all duration-500 ${
              allDropped
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-zinc-700 bg-zinc-900/30"
            }`}
          >
            <p className="mb-6 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {allDropped ? "Files Received" : "Drop Source Files Here"}
            </p>

            {/* Files appearing one by one */}
            <div className="space-y-3">
              {FILES.map((file, i) => {
                const visible = i < droppedCount;
                return (
                  <div
                    key={file.name}
                    className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-all duration-300 ${
                      visible
                        ? "border-zinc-700 bg-zinc-900/80 opacity-100"
                        : "border-zinc-800/50 bg-zinc-900/20 opacity-0"
                    }`}
                    style={{
                      transform: visible ? "translateY(0)" : "translateY(8px)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          visible ? "bg-emerald-500" : "bg-zinc-700"
                        }`}
                        aria-hidden
                      />
                      <span className="text-xs font-medium text-zinc-200">
                        {file.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                        {file.kind}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-zinc-300">
                        {formatCount(file.records)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            {allDropped && (
              <div className="mt-6 border-t border-zinc-800/60 pt-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    Total Records
                  </span>
                  <span className="font-mono text-lg font-bold tabular-nums text-emerald-400">
                    {formatCount(totalRecords)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Fleet waking up */}
          {allDropped && (
            <div className="text-center">
              <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                Fleet Activated
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {["Orchestrator", "Intake", "Normalizer", "Resolver", "Mapper", "Validator", "Trainer", "Eval"].map(
                  (agent) => (
                    <span
                      key={agent}
                      className="flex items-center gap-1.5 rounded border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 cockpit-pulse" aria-hidden />
                      {agent}
                    </span>
                  ),
                )}
              </div>
              <button
                onClick={advance}
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-6 py-2.5 text-sm font-medium text-zinc-200 transition-all hover:bg-zinc-700"
              >
                Watch the pipeline run
                <span aria-hidden>{"->"}</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}