"use client";

/**
 * Full batch view. Shows the full batch flowing through the pipeline with
 * per-stage progress. When a real job is present, every number here comes
 * from the pipeline's actual streamed progress, persisted audit trail, and
 * exceptions -- not a scripted animation. Falls back to the scripted demo
 * only when there is no real job or the API is unreachable.
 *
 * Light theme, TrashLab design language, shared header with back nav.
 * No em-dashes in user-facing text.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import { formatCount } from "@/components/ui/format";
import { useRouter, useSearchParams } from "next/navigation";
import {
  describeAuditEvent,
  getJobAuditEvents,
  getJobExceptions,
  getJobReport,
  getMigrationJob,
} from "@/lib/api";
import type { JobDetail, JobException, JobReport, StageId, StageProgressMap } from "@/lib/api";
import type {
  AgentStage,
  ConfidenceSummary,
  ExceptionQueueItem,
  PipelineEvent,
  SourceSystemView,
} from "@/components/cockpit/types";

const TERMINAL_STATUSES = new Set(["completed", "failed"]);

const STAGE_LABELS: Record<StageId, string> = {
  intake: "Intake",
  normalize: "Normalize",
  resolve: "Entity Resolve",
  map: "Map",
  validate: "Validate",
  review: "Review",
  commit: "Commit",
};

const STAGE_STATUS: Record<StageId, AgentStage["status"]> = {
  intake: "ingesting",
  normalize: "normalizing",
  resolve: "resolving",
  map: "mapping",
  validate: "validating",
  review: "review",
  commit: "committing",
};

const STAGE_ORDER: StageId[] = ["intake", "normalize", "resolve", "map", "validate", "review", "commit"];

function realStages(stageProgress: StageProgressMap): AgentStage[] {
  return STAGE_ORDER.map((id) => {
    const entry = stageProgress[id];
    return {
      id,
      label: STAGE_LABELS[id],
      status: STAGE_STATUS[id],
      progress: entry.total > 0 ? Math.min(1, entry.processed / entry.total) : entry.phase === "done" ? 1 : 0,
      processed: entry.processed,
      total: entry.total,
      throughput: 0,
      phase: entry.phase,
    };
  });
}

function realSources(job: JobDetail): SourceSystemView[] {
  const done = TERMINAL_STATUSES.has(job.status);
  return job.sourceFiles.map((f) => ({
    id: f.id,
    kind: f.kind,
    fileName: f.fileName,
    recordCount: f.recordCount,
    status: done ? "parsed" : "parsing",
    parseErrors: 0,
  }));
}

function toQueueItem(e: JobException): ExceptionQueueItem {
  return {
    id: e.id,
    type: e.type,
    severity: e.severity,
    summary: e.summary,
    confidence: e.confidence,
    reviewStatus: e.reviewStatus,
    suggestedFix: e.suggestedFix,
  };
}

function reportToConfidence(report: JobReport): ConfidenceSummary {
  const high = report.confidenceHistogram.slice(9, 10).reduce((sum, b) => sum + b.count, 0);
  const medium = report.confidenceHistogram.slice(7, 9).reduce((sum, b) => sum + b.count, 0);
  const low = report.confidenceHistogram.slice(0, 7).reduce((sum, b) => sum + b.count, 0);
  const total = high + medium + low;
  const mean =
    total === 0
      ? 0
      : report.confidenceHistogram.reduce((sum, b, i) => sum + (i * 0.1 + 0.05) * b.count, 0) / total;
  return {
    high,
    medium,
    low,
    buckets: report.confidenceHistogram.map((b, i) => ({ lower: i * 0.1, count: b.count })),
    mean,
  };
}

const EMPTY_CONFIDENCE: ConfidenceSummary = { high: 0, medium: 0, low: 0, buckets: [], mean: 0 };

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
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const [tick, setTick] = useState(0);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [realExceptions, setRealExceptions] = useState<JobException[] | null>(null);
  const [realReport, setRealReport] = useState<JobReport | null>(null);
  const [liveEvents, setLiveEvents] = useState<PipelineEvent[]>([]);
  const seenDoneStages = useRef<Set<StageId>>(new Set());

  // Real job polling: while a real jobId is present, poll status every 1.5s.
  // As each pipeline stage completes, synthesize a real activity-feed entry
  // from the actual stageProgress counts. Once the job reaches a terminal
  // state, fetch its real exceptions, report, and persisted audit trail.
  // Falls back to the scripted tick animation if the API is unreachable.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const latest = await getMigrationJob(jobId);
      if (cancelled) return;

      if (latest?.stageProgress) {
        for (const id of STAGE_ORDER) {
          const entry = latest.stageProgress[id];
          if (entry.phase === "done" && !seenDoneStages.current.has(id)) {
            seenDoneStages.current.add(id);
            setLiveEvents((prev) => [
              ...prev,
              {
                id: `stage-${id}`,
                stageId: id,
                type: "StageCompleted",
                message: `${STAGE_LABELS[id]} complete: ${formatCount(entry.processed)}${entry.total ? ` / ${formatCount(entry.total)}` : ""} records.`,
                at: new Date().toISOString(),
                level: "info",
              },
            ]);
          }
        }
      }

      if (latest && TERMINAL_STATUSES.has(latest.status)) {
        // Fetch exceptions/report/audit before flipping to "complete" so
        // the header count and panels never show a stale/zero value.
        const [excs, report, audit] = await Promise.all([
          getJobExceptions(jobId),
          getJobReport(jobId),
          getJobAuditEvents(jobId),
        ]);
        if (cancelled) return;
        setRealExceptions(excs);
        setRealReport(report);
        if (audit) {
          setLiveEvents(
            audit.map((e) => {
              const { message, level } = describeAuditEvent(e);
              return { id: e.id, stageId: "commit", type: e.type, message, at: e.at, level };
            }),
          );
        }
        setJob(latest);
      } else {
        if (latest) setJob(latest);
        timer = setTimeout(poll, 1500);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  // Scripted fallback timestamps: events fire at relative offsets from mount
  const [startTime] = useState(() => Date.now());
  const scriptedEvents: PipelineEvent[] = useMemo(() => {
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
    if (jobId) return; // real job drives its own timing
    if (tick >= TOTAL_TICKS) return;
    const timer = setTimeout(() => setTick((t) => t + 1), 600);
    return () => clearTimeout(timer);
  }, [tick, jobId]);

  const hasRealJob = jobId !== null;
  const complete = hasRealJob ? job !== null && TERMINAL_STATUSES.has(job.status) : tick >= TOTAL_TICKS;

  const scriptedExceptionCount = Math.round(1501 * Math.min(1, tick / TOTAL_TICKS));
  const exceptionCount = realExceptions ? realExceptions.length : hasRealJob ? 0 : scriptedExceptionCount;
  const recordTotal = job ? job.sourceFiles.reduce((sum, f) => sum + f.recordCount, 0) : 150_000;
  const sources = job ? realSources(job) : FULL_SOURCES;
  const stages = job?.stageProgress ? realStages(job.stageProgress) : buildFullStages(tick);
  const events = hasRealJob ? liveEvents : scriptedEvents;
  const confidence = realReport ? reportToConfidence(realReport) : hasRealJob ? EMPTY_CONFIDENCE : FULL_CONFIDENCE;
  const visibleExceptions: ExceptionQueueItem[] = realExceptions
    ? realExceptions.slice(0, 8).map(toQueueItem)
    : hasRealJob
      ? []
      : COMPLETE_EXCEPTIONS.slice(0, Math.min(COMPLETE_EXCEPTIONS.length, Math.ceil(scriptedExceptionCount / 188)));

  return (
    <div className="flex h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel={`Full Batch / ${formatCount(recordTotal)} records`}
        status={{ label: complete ? "batch complete" : "running", active: !complete }}
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Records</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{formatCount(recordTotal)}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Exceptions</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{formatCount(exceptionCount)}</p>
            </div>
            {complete && (
              <button
                onClick={() => router.push(jobId ? `/migrate/review?job=${jobId}` : "/migrate/review")}
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
        <SourceSystemsPanel sources={sources} />
        <PipelineActivityPanel stages={stages} events={events} />
        <ExceptionQueuePanel exceptions={visibleExceptions} confidence={confidence} />
      </div>
    </div>
  );
}
