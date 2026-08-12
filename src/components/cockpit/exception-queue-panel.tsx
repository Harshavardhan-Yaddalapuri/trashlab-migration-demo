import { formatCount } from "@/components/ui/format";
import type {
  ConfidenceSummary,
  ExceptionQueueItem,
} from "@/components/cockpit/types";

const SEVERITY_COLORS: Record<ExceptionQueueItem["severity"], string> = {
  critical: "text-red-400",
  warning: "text-amber-400",
  info: "text-zinc-400",
};

const SEVERITY_BARS: Record<ExceptionQueueItem["severity"], string> = {
  critical: "border-red-600/60",
  warning: "border-amber-600/50",
  info: "border-zinc-700",
};

const REVIEW_STATUS_COLORS: Record<ExceptionQueueItem["reviewStatus"], string> = {
  open: "text-zinc-400",
  approved: "text-emerald-400",
  rejected: "text-red-400",
};

function formatConfidence(value: number): string {
  return value.toFixed(2);
}

function confidenceBarWidth(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}

export function ExceptionQueuePanel({
  exceptions,
  confidence,
}: {
  exceptions: ExceptionQueueItem[];
  confidence: ConfidenceSummary;
}) {
  const total = confidence.high + confidence.medium + confidence.low;

  return (
    <section
      aria-label="Exception queue and confidence"
      className="flex flex-col border-l border-zinc-800/60 bg-zinc-950"
    >
      <div className="border-b border-zinc-800/60 px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          Exception Queue
        </h2>
      </div>

      {/* Exception list */}
      {exceptions.length === 0 ? (
        <div className="flex items-center justify-center px-4 py-12">
          <p className="font-mono text-xs text-zinc-600">No exceptions</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-zinc-800/40 overflow-y-auto">
          {exceptions.map((exc) => (
            <li
              key={exc.id}
              className={`border-l-2 ${SEVERITY_BARS[exc.severity]} px-4 py-3`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${SEVERITY_COLORS[exc.severity]}`}
                >
                  {exc.type}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${REVIEW_STATUS_COLORS[exc.reviewStatus]}`}
                >
                  {exc.reviewStatus}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-200">
                {exc.summary}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                Fix: {exc.suggestedFix}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500/70 transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: confidenceBarWidth(exc.confidence) }}
                    aria-label={`Confidence ${formatConfidence(exc.confidence)}`}
                  />
                </div>
                <span className="font-mono text-[10px] tabular-nums text-zinc-500">
                  {formatConfidence(exc.confidence)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confidence meters */}
      <div className="border-t border-zinc-800/60">
        <div className="px-4 py-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Confidence Distribution
          </h3>
        </div>
        <div className="px-4 pb-3">
          {/* Histogram */}
          <div className="flex items-end gap-0.5 h-12">
            {confidence.buckets.map((bucket, i) => {
              const maxCount = Math.max(...confidence.buckets.map((b) => b.count));
              const heightPct = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
              return (
                <div
                  key={i}
                  className="flex-1 bg-emerald-500/30 transition-all duration-300 motion-reduce:transition-none"
                  style={{ height: `${heightPct}%` }}
                  title={`${bucket.lower.toFixed(1)}-${(bucket.lower + 0.1).toFixed(1)}: ${formatCount(bucket.count)}`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex justify-between">
            <span className="font-mono text-[9px] text-zinc-700">0.0</span>
            <span className="font-mono text-[9px] text-zinc-700">1.0</span>
          </div>
        </div>
        <div className="grid grid-cols-3 divide-x divide-zinc-800/60 border-t border-zinc-800/60">
          <div className="px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              High
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-emerald-400">
              {formatCount(confidence.high)}
            </p>
            <p className="font-mono text-[9px] text-zinc-700">
              {total > 0 ? `${((confidence.high / total) * 100).toFixed(1)}%` : "--"}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              Medium
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-amber-400">
              {formatCount(confidence.medium)}
            </p>
            <p className="font-mono text-[9px] text-zinc-700">
              {total > 0 ? `${((confidence.medium / total) * 100).toFixed(1)}%` : "--"}
            </p>
          </div>
          <div className="px-3 py-2.5">
            <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
              Low
            </p>
            <p className="mt-0.5 font-mono text-sm tabular-nums text-red-400">
              {formatCount(confidence.low)}
            </p>
            <p className="font-mono text-[9px] text-zinc-700">
              {total > 0 ? `${((confidence.low / total) * 100).toFixed(1)}%` : "--"}
            </p>
          </div>
        </div>
        <div className="border-t border-zinc-800/60 px-4 py-2.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              Mean Confidence
            </span>
            <span className="font-mono text-sm tabular-nums text-zinc-100">
              {formatConfidence(confidence.mean)}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}