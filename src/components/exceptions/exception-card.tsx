import type { ExceptionIssue } from "@/lib/types";

export function ExceptionCard({ exception }: { exception: ExceptionIssue }) {
  const severityColor =
    exception.severity === "critical"
      ? "text-red-400"
      : exception.severity === "warning"
        ? "text-amber-400"
        : "text-zinc-400";
  return (
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-mono text-xs uppercase tracking-widest ${severityColor}`}>
            {exception.type}
          </p>
          <h3 className="mt-1 text-sm font-medium text-zinc-100">{exception.summary}</h3>
        </div>
        <span className="shrink-0 font-mono text-xs text-zinc-500">{exception.reviewStatus}</span>
      </div>
      <ul className="mt-3 space-y-1">
        {exception.evidence.map((item) => (
          <li key={item} className="font-mono text-xs text-zinc-400">
            {item}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">Suggested fix: {exception.suggestedFix}</p>
    </article>
  );
}
