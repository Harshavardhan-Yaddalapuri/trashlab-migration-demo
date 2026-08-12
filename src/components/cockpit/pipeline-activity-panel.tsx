import { formatCount } from "@/components/ui/format";
import type { AgentStage, PipelineEvent } from "@/components/cockpit/types";

const PHASE_STYLES: Record<AgentStage["phase"], { dot: string; text: string; bar: string }> = {
  waiting: { dot: "bg-slate-200", text: "text-slate-400", bar: "bg-slate-200" },
  active: { dot: "bg-[#10a6cc]", text: "text-[#10a6cc]", bar: "bg-[#10a6cc]" },
  done: { dot: "bg-[#10b981]", text: "text-[#10b981]", bar: "bg-[#10b981]" },
  error: { dot: "bg-red-500", text: "text-red-500", bar: "bg-red-500" },
};

const EVENT_LEVEL_COLORS: Record<PipelineEvent["level"], string> = {
  info: "text-slate-500",
  warn: "text-amber-600",
  error: "text-red-500",
};

const EVENT_LEVEL_BARS: Record<PipelineEvent["level"], string> = {
  info: "border-[#e0deff]",
  warn: "border-amber-300",
  error: "border-red-300",
};

function stageProgressPct(stage: AgentStage): number {
  return Math.round(Math.min(1, Math.max(0, stage.progress)) * 100);
}

function formatThroughput(stage: AgentStage): string {
  if (stage.throughput === 0) return "--";
  return `${formatCount(stage.throughput)}/s`;
}

export function PipelineActivityPanel({
  stages,
  events,
}: {
  stages: AgentStage[];
  events: PipelineEvent[];
}) {
  return (
    <section
      aria-label="Pipeline activity"
      className="flex flex-col bg-white"
    >
      <div className="border-b border-[#e0deff] px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
          Pipeline
        </h2>
      </div>

      {/* Agent stages */}
      <div className="border-b border-[#e0deff]">
        <ul className="flex flex-col">
          {stages.map((stage) => {
            const style = PHASE_STYLES[stage.phase];
            const pct = stageProgressPct(stage);
            return (
              <li
                key={stage.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${style.dot} ${stage.phase === "active" ? "cockpit-pulse" : ""}`}
                  aria-hidden
                />
                <div className="w-28 shrink-0">
                  <span className="text-xs font-medium text-slate-800">
                    {stage.label}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${style.bar} transition-all duration-500 motion-reduce:transition-none`}
                      style={{ width: `${pct}%` }}
                      aria-label={`${stage.label} ${pct}%`}
                    />
                  </div>
                </div>
                <div className="flex w-32 shrink-0 items-center justify-end gap-3">
                  <span className={`font-mono text-[10px] tabular-nums ${style.text}`}>
                    {formatCount(stage.processed)}/{formatCount(stage.total)}
                  </span>
                  <span className="w-16 text-right font-mono text-[10px] tabular-nums text-slate-400">
                    {formatThroughput(stage)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Activity feed */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-[#e0deff]/60 px-4 py-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">
            Activity Feed
          </h3>
        </div>
        {events.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-4 py-12">
            <p className="text-xs text-slate-400">Waiting for events...</p>
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {events.map((evt) => (
              <li
                key={evt.id}
                className={`border-l-2 ${EVENT_LEVEL_BARS[evt.level]} px-4 py-2`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${EVENT_LEVEL_COLORS[evt.level]}`}>
                    {evt.type}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400">
                    {new Date(evt.at).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">
                  {evt.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
