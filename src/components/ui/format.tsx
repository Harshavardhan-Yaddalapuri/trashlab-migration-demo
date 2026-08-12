import { config } from "@/lib/config";

export function PipelineStatusBadge({ status }: { status: string }) {
  const color =
    status === "completed"
      ? "bg-emerald-500/15 text-emerald-400"
      : status === "failed"
        ? "bg-red-500/15 text-red-400"
        : status === "review"
          ? "bg-amber-500/15 text-amber-400"
          : "bg-zinc-500/15 text-zinc-400";
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-xs uppercase tracking-widest ${color}`}
    >
      {status}
    </span>
  );
}

export function ProgressBar({ progress }: { progress: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all"
        style={{ width: `${pct}%` }}
        aria-label={`Progress ${pct}%`}
      />
    </div>
  );
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function appVersion(): string {
  return config.app.version;
}
