import { formatCount } from "@/components/ui/format";
import type { SourceSystemView } from "@/components/cockpit/types";

const KIND_LABELS: Record<SourceSystemView["kind"], string> = {
  "routepro-csv": "RoutePro CSV",
  "quickbooks-export": "QuickBooks",
  "transfer-spreadsheet": "Transfer Station",
  "legacy-export": "Legacy Export",
};

const STATUS_COLORS: Record<SourceSystemView["status"], string> = {
  pending: "text-zinc-500",
  parsing: "text-amber-400",
  parsed: "text-emerald-400",
  error: "text-red-400",
};

const STATUS_DOTS: Record<SourceSystemView["status"], string> = {
  pending: "bg-zinc-600",
  parsing: "bg-amber-500",
  parsed: "bg-emerald-500",
  error: "bg-red-500",
};

export function SourceSystemsPanel({ sources }: { sources: SourceSystemView[] }) {
  return (
    <section
      aria-label="Source systems"
      className="flex flex-col border-r border-zinc-800/60 bg-zinc-950"
    >
      <div className="border-b border-zinc-800/60 px-4 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
          Source Systems
        </h2>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="font-mono text-xs text-zinc-600">No sources loaded</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-zinc-800/40">
          {sources.map((src) => (
            <li key={src.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOTS[src.status]}`}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-medium text-zinc-200">
                    {src.fileName}
                  </span>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${STATUS_COLORS[src.status]}`}
                >
                  {src.status}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 pl-3.5">
                <span className="font-mono text-[10px] text-zinc-600">
                  {KIND_LABELS[src.kind]}
                </span>
                <span className="font-mono text-xs tabular-nums text-zinc-300">
                  {formatCount(src.recordCount)}
                </span>
              </div>
              {src.parseErrors > 0 && (
                <p className="mt-1 pl-3.5 font-mono text-[10px] text-amber-400/80">
                  {src.parseErrors} parse error{src.parseErrors > 1 ? "s" : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-zinc-800/60 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Total Records
          </span>
          <span className="font-mono text-sm tabular-nums text-zinc-100">
            {formatCount(sources.reduce((sum, s) => sum + s.recordCount, 0))}
          </span>
        </div>
      </div>
    </section>
  );
}