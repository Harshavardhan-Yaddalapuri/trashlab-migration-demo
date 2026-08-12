import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import {
  mockSourceSystems,
  mockAgentStages,
  mockPipelineEvents,
  mockExceptionQueue,
  mockConfidenceSummary,
} from "@/components/cockpit/mock-data";
import { formatCount } from "@/components/ui/format";

export function CockpitShell() {
  const totalRecords = mockSourceSystems.reduce((sum, s) => sum + s.recordCount, 0);
  const openExceptions = mockExceptionQueue.filter((e) => e.reviewStatus === "open").length;

  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      {/* Header bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            TrashLab Migration Cockpit
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Summit Disposal Services
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 cockpit-pulse" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">
              mapping
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                Records
              </span>
              <p className="font-mono text-xs tabular-nums text-zinc-300">
                {formatCount(totalRecords)}
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                Exceptions
              </span>
              <p className="font-mono text-xs tabular-nums text-amber-400">
                {openExceptions}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* 3-pane layout */}
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[260px_1fr_320px]">
        <SourceSystemsPanel sources={mockSourceSystems} />
        <PipelineActivityPanel
          stages={mockAgentStages}
          events={mockPipelineEvents}
        />
        <ExceptionQueuePanel
          exceptions={mockExceptionQueue}
          confidence={mockConfidenceSummary}
        />
      </div>
    </div>
  );
}