"use client";

/**
 * Live sample view. Shows the cockpit shell with ~500 rows animating
 * through the pipeline. Progress bars fill incrementally. User advances
 * to full-batch view when ready.
 *
 * No em-dashes in user-facing text.
 */

import { useEffect, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import { formatCount } from "@/components/ui/format";
import type {
  AgentStage,
  ConfidenceSummary,
  ExceptionQueueItem,
  PipelineEvent,
  SourceSystemView,
} from "@/components/cockpit/types";

/** Stages for live sample (500 rows flowing). */
function buildSampleStages(tick: number): AgentStage[] {
  const sampleSize = 500;
  const progress = Math.min(1, tick / 20);

  return [
    { id: "intake", label: "Intake", status: "ingesting", progress: 1, processed: sampleSize, total: sampleSize, throughput: 800, phase: "done" },
    {
      id: "normalize",
      label: "Normalize",
      status: "normalizing",
      progress: Math.min(1, Math.max(0, progress * 1.5)),
      processed: Math.round(sampleSize * Math.min(1, progress * 1.5)),
      total: sampleSize,
      throughput: 650,
      phase: progress < 0.67 ? "active" : "done",
    },
    {
      id: "resolve",
      label: "Entity Resolve",
      status: "resolving",
      progress: Math.min(1, Math.max(0, progress * 1.2)),
      processed: Math.round(150 * Math.min(1, progress * 1.2)),
      total: 150,
      throughput: 320,
      phase: progress < 0.83 ? "active" : "done",
    },
    {
      id: "map",
      label: "Map",
      status: "mapping",
      progress: Math.min(1, Math.max(0, progress)),
      processed: Math.round(sampleSize * progress),
      total: sampleSize,
      throughput: 280,
      phase: progress < 1 ? "active" : "done",
    },
    { id: "validate", label: "Validate", status: "validating", progress: 0, processed: 0, total: sampleSize, throughput: 0, phase: "waiting" },
    { id: "review", label: "Review", status: "review", progress: 0, processed: 0, total: 5, throughput: 0, phase: "waiting" },
    { id: "commit", label: "Commit", status: "committing", progress: 0, processed: 0, total: sampleSize, throughput: 0, phase: "waiting" },
  ];
}

const SAMPLE_SOURCES: SourceSystemView[] = [
  { id: "src-routepro", kind: "routepro-csv", fileName: "routepro_2019_export.csv", recordCount: 78_000, status: "parsing", parseErrors: 0 },
  { id: "src-quickbooks", kind: "quickbooks-export", fileName: "quickbooks_customer_export.tsv", recordCount: 45_000, status: "parsing", parseErrors: 0 },
  { id: "src-transfer", kind: "transfer-spreadsheet", fileName: "transfer_station_weights.xlsx", recordCount: 20_000, status: "pending", parseErrors: 0 },
  { id: "src-legacy", kind: "legacy-export", fileName: "legacy_paper_export.tab", recordCount: 7_000, status: "pending", parseErrors: 0 },
];

const SAMPLE_EVENTS: PipelineEvent[] = [
  { id: "evt-s1", stageId: "intake", type: "SourceParsed", message: "Parsing 4 source files...", at: new Date().toISOString(), level: "info" },
  { id: "evt-s2", stageId: "normalize", type: "RecordNormalized", message: "Normalizing 500 sample records", at: new Date().toISOString(), level: "info" },
  { id: "evt-s3", stageId: "resolve", type: "CustomerResolved", message: "Found 3 duplicate clusters in sample", at: new Date().toISOString(), level: "info" },
];

const SAMPLE_EXCEPTIONS: ExceptionQueueItem[] = [
  { id: "exc-s1", type: "duplicate_customer", severity: "warning", summary: "'Summit Construction LLC' and 'S. Construction' share address+phone", confidence: 0.91, reviewStatus: "open", suggestedFix: "Merge into canonical record C-00231." },
];

const SAMPLE_CONFIDENCE: ConfidenceSummary = {
  high: 480,
  medium: 15,
  low: 5,
  buckets: [
    { lower: 0.0, count: 3 }, { lower: 0.1, count: 1 }, { lower: 0.2, count: 1 },
    { lower: 0.3, count: 0 }, { lower: 0.4, count: 0 }, { lower: 0.5, count: 2 },
    { lower: 0.6, count: 3 }, { lower: 0.7, count: 5 }, { lower: 0.8, count: 8 },
    { lower: 0.9, count: 477 },
  ],
  mean: 0.93,
};

export function LiveSampleView() {
  const advance = useDemoStore((s) => s.advance);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (tick >= 20) return;
    const timer = setTimeout(() => setTick((t) => t + 1), 150);
    return () => clearTimeout(timer);
  }, [tick]);

  const stages = buildSampleStages(tick);
  const complete = tick >= 20;

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            TrashLab Migration Cockpit
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Live Sample / 500 rows
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Records</span>
            <p className="font-mono text-xs tabular-nums text-zinc-300">{formatCount(500)}</p>
          </div>
          {complete && (
            <button
              onClick={advance}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/30"
            >
              Run full 150k batch
              <span aria-hidden>{"->"}</span>
            </button>
          )}
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_320px]">
        <SourceSystemsPanel sources={SAMPLE_SOURCES} />
        <PipelineActivityPanel stages={stages} events={SAMPLE_EVENTS} />
        <ExceptionQueuePanel exceptions={SAMPLE_EXCEPTIONS} confidence={SAMPLE_CONFIDENCE} />
      </div>
    </div>
  );
}