"use client";

/**
 * Full batch view. Shows the full 150k records flowing through the pipeline
 * with per-agent throughput. All stages animate to completion over ~24s
 * so the fleet visibly works. User advances to exception review when done.
 *
 * Light theme, TrashLab design language, shared header with back nav.
 * Real timestamps generated relative to now.
 * No em-dashes in user-facing text.
 */

import { useEffect, useMemo, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import { formatCount } from "@/components/ui/format";
import { useRouter } from "next/navigation";
import type {
  AgentStage,
  ConfidenceSummary,
  ExceptionQueueItem,
  PipelineEvent,
  SourceSystemView,
} from "@/components/cockpit/types";

const TOTAL_TICKS = 40; // 40 * 600ms = 24s of visible fleet work

function buildFullStages(tick: number): AgentStage[] {
  const total = 150_000;
  const progress = Math.min(1, tick / TOTAL_TICKS);

  const stagesConfig = [
    { id: "intake", label: "Intake", throughput: 32_000, factor: 1.0 },
    { id: "normalize", label: "Normalize", throughput: 28_000, factor: 0.9 },
    { id: "resolve", label: "Entity Resolve", throughput: 14_000, factor: 0.75 },
    { id: "map", label: "Map", throughput: 9_500, factor: 0.6 },
    { id: "validate", label: "Validate", throughput: 12_000, factor: 0.45 },
  ];

  const stages: AgentStage[] = stagesConfig.map((cfg) => {
    const stageProgress = Math.min(1, progress / cfg.factor);
    const processed = Math.round(total * stageProgress);
    const isDone = stageProgress >= 1;
    const isActive = !isDone && stageProgress > 0;
    return {
      id: cfg.id,
      label: cfg.label,
      status: cfg.id === "intake" ? "ingesting" : cfg.id === "normalize" ? "normalizing" : cfg.id === "resolve" ? "resolving" : cfg.id === "map" ? "mapping" : "validating",
      progress: stageProgress,
      processed,
      total,
      throughput: isActive ? cfg.throughput : isDone ? cfg.throughput : 0,
      phase: isDone ? "done" : isActive ? "active" : "waiting",
    };
  });

  // Review + commit stages
  const reviewProgress = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));
  stages.push({
    id: "review",
    label: "Review",
    status: "review",
    progress: reviewProgress,
    processed: Math.round(1501 * reviewProgress),
    total: 1501,
    throughput: reviewProgress > 0 && reviewProgress < 1 ? 50 : 0,
    phase: reviewProgress >= 1 ? "done" : reviewProgress > 0 ? "active" : "waiting",
  });

  stages.push({
    id: "commit",
    label: "Commit",
    status: "committing",
    progress: Math.min(1, Math.max(0, (progress - 0.7) / 0.3)),
    processed: Math.round(total * Math.min(1, Math.max(0, (progress - 0.7) / 0.3))),
    total,
    throughput: 0,
    phase: progress >= 1 ? "done" : progress > 0.7 ? "active" : "waiting",
  });

  return stages;
}

const FULL_SOURCES: SourceSystemView[] = [
  { id: "src-routepro", kind: "routepro-csv", fileName: "routepro_2019_export.csv", recordCount: 78_000, status: "parsed", parseErrors: 0 },
  { id: "src-quickbooks", kind: "quickbooks-export", fileName: "quickbooks_customer_export.tsv", recordCount: 45_000, status: "parsed", parseErrors: 0 },
  { id: "src-transfer", kind: "transfer-spreadsheet", fileName: "transfer_station_weights.xlsx", recordCount: 20_000, status: "parsed", parseErrors: 3 },
  { id: "src-legacy", kind: "legacy-export", fileName: "legacy_paper_export.tab", recordCount: 7_000, status: "parsed", parseErrors: 12 },
];

const FULL_CONFIDENCE: ConfidenceSummary = {
  high: 136_500,
  medium: 11_800,
  low: 1_700,
  buckets: [
    { lower: 0.0, count: 850 }, { lower: 0.1, count: 420 }, { lower: 0.2, count: 180 },
    { lower: 0.3, count: 250 }, { lower: 0.4, count: 0 }, { lower: 0.5, count: 0 },
    { lower: 0.6, count: 0 }, { lower: 0.7, count: 3_200 }, { lower: 0.8, count: 8_600 },
    { lower: 0.9, count: 136_500 },
  ],
  mean: 0.94,
};

const COMPLETE_EXCEPTIONS: ExceptionQueueItem[] = [
  { id: "exc-001", type: "pricing_conflict", severity: "critical", summary: "Agreement A-04231: two rates ($300 vs $450) for same container+site", confidence: 0.97, reviewStatus: "open", suggestedFix: "Use most recent rate from QuickBooks export ($450/mo)." },
  { id: "exc-002", type: "orphan_container", severity: "warning", summary: "Container RC-33109 has no owning site assignment", confidence: 0.88, reviewStatus: "open", suggestedFix: "Assign to nearest yard site S-02104 (Springfield West)." },
  { id: "exc-003", type: "unmappable_code", severity: "warning", summary: "Service code 'NOPE-1' on agreement A-08992 has no mapping rule", confidence: 0.82, reviewStatus: "open", suggestedFix: "Map to SW-RO-30YD based on container size analysis." },
  { id: "exc-004", type: "closed_unbilled", severity: "info", summary: "Agreement A-01567 closed 2026-03-01 but unbilled for 2 months", confidence: 0.94, reviewStatus: "open", suggestedFix: "Generate back-invoice for Mar-Apr at agreed rate." },
  { id: "exc-005", type: "duplicate_customer", severity: "warning", summary: "'Summit Construction LLC' and 'S. Construction' share address+phone", confidence: 0.91, reviewStatus: "open", suggestedFix: "Merge into canonical record C-00231." },
  { id: "exc-006", type: "ungeocodable", severity: "info", summary: "Site S-04823 has PO Box address, cannot geocode", confidence: 0.99, reviewStatus: "open", suggestedFix: "Request physical address from customer." },
  { id: "exc-007", type: "unmatched_ticket", severity: "info", summary: "Scale ticket T-09231 has no container or agreement link", confidence: 0.86, reviewStatus: "open", suggestedFix: "Match to agreement A-02114 by date and route." },
  { id: "exc-008", type: "date_ambiguity", severity: "warning", summary: "Agreement A-03102: date '01/02/23' could be Jan 2 or Feb 1", confidence: 0.75, reviewStatus: "open", suggestedFix: "Confirm with customer: contract start date on file is Jan 2, 2023." },
];

export function FullBatchView() {
  const router = useRouter();
  const [tick, setTick] = useState(0);

  // Real timestamps: events fire at relative offsets from mount
  const [startTime] = useState(() => Date.now());
  const events: PipelineEvent[] = useMemo(() => {
    const at = (offsetSec: number) => new Date(startTime + offsetSec * 1000).toISOString();
    return [
      { id: "evt-f1", stageId: "intake", type: "SourceParsed", message: "Parsed 4 source files, 150,000 raw records ingested", at: at(1), level: "info" },
      { id: "evt-f2", stageId: "normalize", type: "RecordNormalized", message: "Normalized 150,000 records. 423 date ambiguities flagged.", at: at(6), level: "info" },
      { id: "evt-f3", stageId: "resolve", type: "CustomerResolved", message: "Resolved 45,000 customers. 2,200 duplicate clusters found.", at: at(11), level: "info" },
      { id: "evt-f4", stageId: "resolve", type: "CustomerAutoMerged", message: "Auto-merged 2,000 clusters above 0.90 confidence.", at: at(12), level: "info" },
      { id: "evt-f5", stageId: "map", type: "MappingProposed", message: "Mapping 138,000 of 150,000 records. 99.2% auto-map rate.", at: at(17), level: "info" },
      { id: "evt-f6", stageId: "map", type: "ExceptionRaised", message: "Pricing conflict: agreement A-04231 has two rates for same container+site.", at: at(19), level: "warn" },
      { id: "evt-f7", stageId: "validate", type: "ExceptionRaised", message: "Orphan container RC-33109 has no owning site.", at: at(21), level: "error" },
    ];
  }, [startTime]);

  useEffect(() => {
    if (tick >= TOTAL_TICKS) return;
    const timer = setTimeout(() => setTick((t) => t + 1), 600);
    return () => clearTimeout(timer);
  }, [tick]);

  const stages = buildFullStages(tick);
  const complete = tick >= TOTAL_TICKS;

  // Show exceptions progressively
  const exceptionCount = Math.round(1501 * Math.min(1, tick / TOTAL_TICKS));
  const visibleExceptions: ExceptionQueueItem[] = COMPLETE_EXCEPTIONS.slice(0, Math.min(COMPLETE_EXCEPTIONS.length, Math.ceil(exceptionCount / 188)));

  return (
    <div className="flex h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel="Full Batch / 150,000 records"
        status={{ label: complete ? "batch complete" : "running", active: !complete }}
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Records</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{formatCount(150_000)}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Exceptions</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{formatCount(exceptionCount)}</p>
            </div>
            {complete && (
              <button
                onClick={() => router.push("/migrate/review")}
                className="inline-flex items-center gap-2 rounded-full bg-[#312d97] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#5149d7]"
              >
                Review exceptions
                <span aria-hidden>{"->"}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_320px]">
        <SourceSystemsPanel sources={FULL_SOURCES} />
        <PipelineActivityPanel stages={stages} events={events} />
        <ExceptionQueuePanel exceptions={visibleExceptions} confidence={FULL_CONFIDENCE} />
      </div>
    </div>
  );
}
