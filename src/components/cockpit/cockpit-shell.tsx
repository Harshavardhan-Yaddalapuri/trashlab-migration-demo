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
    <div className="flex h-screen flex-col bg-white">
      {/* Header bar */}
      <header className="flex shrink-0 items-center justify-between bg-[#1a174f] px-5 py-2.5">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/trashlab-logo.svg" alt="TrashLab" className="h-6 w-auto" />
          <h1 className="text-sm font-semibold tracking-tight text-white/90">
            Migration Cockpit
          </h1>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
            Summit Disposal Services
          </span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#10b981] cockpit-pulse" aria-hidden />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              mapping
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
                Records
              </span>
              <p className="font-mono text-xs tabular-nums text-white/90">
                {formatCount(totalRecords)}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">
                Exceptions
              </span>
              <p className="font-mono text-xs tabular-nums text-white/90">
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
