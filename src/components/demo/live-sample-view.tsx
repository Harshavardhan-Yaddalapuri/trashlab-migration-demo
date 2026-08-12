"use client";

/**
 * Live sample view. Shows the cockpit shell with the pipeline's real,
 * streamed per-stage progress when a real job is present -- not a scripted
 * animation. User advances to full-batch view when the job is done.
 *
 * Light theme, TrashLab design language, shared header with back nav.
 * No em-dashes in user-facing text.
 */

import { useEffect, useRef, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import { formatCount } from "@/components/ui/format";
import { useRouter, useSearchParams } from "next/navigation";
import { getMigrationJob } from "@/lib/api";
import type { JobDetail, StageId, StageProgressMap } from "@/lib/api";
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

/** Map a real job's source files to the source-systems panel view model. */
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

/** Stages for the scripted fallback (500 rows flowing). */
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

const EMPTY_CONFIDENCE: ConfidenceSummary = { high: 0, medium: 0, low: 0, buckets: [], mean: 0 };

export function LiveSampleView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job");
  const [tick, setTick] = useState(0);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [liveEvents, setLiveEvents] = useState<PipelineEvent[]>([]);
  const seenDoneStages = useRef<Set<StageId>>(new Set());

  useEffect(() => {
    if (jobId) return; // real job drives its own timing
    if (tick >= 20) return;
    const timer = setTimeout(() => setTick((t) => t + 1), 150);
    return () => clearTimeout(timer);
  }, [tick, jobId]);

  // Real job polling: while a real jobId is present, poll status every 1.5s
  // until the pipeline reaches a terminal state, synthesizing a real
  // activity-feed entry from actual stageProgress counts as each stage
  // completes. Falls back to the scripted tick animation if the API is
  // unreachable or no jobId was created.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const latest = await getMigrationJob(jobId);
      if (cancelled) return;
      if (latest) setJob(latest);

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

      if (!latest || !TERMINAL_STATUSES.has(latest.status)) {
        timer = setTimeout(poll, 1500);
      }
    };
    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  const hasRealJob = jobId !== null;
  const complete = hasRealJob ? job !== null && TERMINAL_STATUSES.has(job.status) : tick >= 20;
  const recordTotal = job ? job.sourceFiles.reduce((sum, f) => sum + f.recordCount, 0) : 500;
  const sources = job ? realSources(job) : SAMPLE_SOURCES;
  const stages = job?.stageProgress ? realStages(job.stageProgress) : buildSampleStages(tick);
  const events = hasRealJob ? liveEvents : SAMPLE_EVENTS;
  const exceptions = hasRealJob ? [] : SAMPLE_EXCEPTIONS;
  const confidence = hasRealJob ? EMPTY_CONFIDENCE : SAMPLE_CONFIDENCE;

  return (
    <div className="flex h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel={`Live Sample / ${formatCount(recordTotal)} rows`}
        status={{ label: complete ? "sample complete" : "running", active: !complete }}
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Records</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{formatCount(recordTotal)}</p>
            </div>
            {complete && (
              <button
                onClick={() => router.push(jobId ? `/migrate/batch?job=${jobId}` : "/migrate/batch")}
                className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#0d9a6c]"
              >
                {hasRealJob ? `Run full batch (${formatCount(recordTotal)})` : "Run full 150k batch"}
                <span aria-hidden>{"->"}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_320px]">
        <SourceSystemsPanel sources={sources} />
        <PipelineActivityPanel stages={stages} events={events} />
        <ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />
      </div>
    </div>
  );
}
