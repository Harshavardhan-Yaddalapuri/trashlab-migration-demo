import { formatCount } from "@/components/ui/format";
import type { SourceSystemView } from "@/components/cockpit/types";

const KIND_LABELS: Record<SourceSystemView["kind"], string> = {
  "routepro-csv": "RoutePro CSV",
  "quickbooks-export": "QuickBooks",
  "transfer-spreadsheet": "Transfer Station",
  "legacy-export": "Legacy Export",
};

const STATUS_COLORS: Record<SourceSystemView["status"], string> = {
  pending: "text-slate-400",
  parsing: "text-amber-600",
  parsed: "text-[#10b981]",
  error: "text-red-500",
};

const STATUS_DOTS: Record<SourceSystemView["status"], string> = {
  pending: "bg-slate-300",
  parsing: "bg-amber-500",
  parsed: "bg-[#10b981]",
  error: "bg-red-500",
};

export function SourceSystemsPanel({ sources }: { sources: SourceSystemView[] }) {
  return (
    <section
      aria-label="Source systems"
      className="flex flex-col border-r border-[#e0deff] bg-white"
    >
      <div className="border-b border-[#e0deff] px-4 py-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
          Source Systems
        </h2>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <p className="text-xs text-slate-400">No sources loaded</p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-[#e0deff]/60">
          {sources.map((src) => (
            <li key={src.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOTS[src.status]}`}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-medium text-slate-800">
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
                <span className="font-mono text-[10px] text-[#6260af]">
                  {KIND_LABELS[src.kind]}
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-600">
                  {formatCount(src.recordCount)}
                </span>
              </div>
              {src.parseErrors > 0 && (
                <p className="mt-1 pl-3.5 font-mono text-[10px] text-amber-600/80">
                  {src.parseErrors} parse error{src.parseErrors > 1 ? "s" : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[#e0deff] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#6260af]">
            Total Records
          </span>
          <span className="font-mono text-sm tabular-nums text-slate-800">
            {formatCount(sources.reduce((sum, s) => sum + s.recordCount, 0))}
          </span>
        </div>
      </div>
    </section>
  );
}
