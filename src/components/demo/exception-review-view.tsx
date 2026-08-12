"use client";

/**
 * Exception review view. Shows 8 featured exceptions with evidence
 * and suggested fixes, plus the 1,493 aggregated by type with bulk-resolve.
 * User can approve individual exceptions and then advance to the report.
 *
 * No em-dashes in user-facing text.
 */

import { useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { formatCount } from "@/components/ui/format";

interface FeaturedException {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  summary: string;
  evidence: string[];
  suggestedFix: string;
  confidence: number;
}

const FEATURED: FeaturedException[] = [
  {
    id: "exc-001",
    type: "pricing_conflict",
    severity: "critical",
    summary: "Agreement A-04231: two rates ($300 vs $450) for same container+site",
    evidence: ["RoutePro rate: $300/mo (agreement A-04231, row 4231)", "QuickBooks rate: $450/mo (invoice INV-88210, dated 2026-05-01)", "Same container RC-1023 at site S-02104"],
    suggestedFix: "Use most recent rate from QuickBooks export ($450/mo).",
    confidence: 0.97,
  },
  {
    id: "exc-002",
    type: "orphan_container",
    severity: "warning",
    summary: "Container RC-33109 has no owning site assignment",
    evidence: ["RoutePro export row 33109: container ID present, site field empty", "No matching site assignment in any source file", "GPS tag on container: 39.7817, -89.6401 (Springfield West yard vicinity)"],
    suggestedFix: "Assign to nearest yard site S-02104 (Springfield West).",
    confidence: 0.88,
  },
  {
    id: "exc-003",
    type: "unmappable_code",
    severity: "warning",
    summary: "Service code 'NOPE-1' on agreement A-08992 has no mapping rule",
    evidence: ["Legacy code: NOPE-1", "No matching entry in code-mapper rules v3", "Container size: 30yd roll-off (from route template RT-0042)"],
    suggestedFix: "Map to SW-RO-30YD based on container size analysis.",
    confidence: 0.82,
  },
  {
    id: "exc-004",
    type: "closed_unbilled",
    severity: "info",
    summary: "Agreement A-01567 closed 2026-03-01 but unbilled for 2 months",
    evidence: ["Agreement status: closed (closed_at = 2026-03-01)", "No invoices after 2026-02-28", "Service logs show pickups through 2026-04-30"],
    suggestedFix: "Generate back-invoice for Mar-Apr at agreed rate.",
    confidence: 0.94,
  },
  {
    id: "exc-005",
    type: "duplicate_customer",
    severity: "warning",
    summary: "'Summit Construction LLC' and 'S. Construction' share address+phone",
    evidence: ["Customer C-00231: Summit Construction LLC, 412 Industrial Pkwy, +13145550123", "Customer C-00892: S. Construction, 412 Industrial Pkwy, +13145550123", "Same billing contact: John Reyes"],
    suggestedFix: "Merge into canonical record C-00231.",
    confidence: 0.91,
  },
  {
    id: "exc-006",
    type: "ungeocodable",
    severity: "info",
    summary: "Site S-04823 has PO Box address, cannot geocode",
    evidence: ["Address: PO Box 1142, Springfield, IL 62701", "Geocoder returned: no coordinates", "Customer C-03112 has 3 other sites with physical addresses"],
    suggestedFix: "Request physical address from customer.",
    confidence: 0.99,
  },
  {
    id: "exc-007",
    type: "unmatched_ticket",
    severity: "info",
    summary: "Scale ticket T-09231 has no container or agreement link",
    evidence: ["Ticket T-09231: weight 4.2 tons, date 2026-06-15", "No container ID on ticket", "Route RT-0214 serviced same area that day"],
    suggestedFix: "Match to agreement A-02114 by date and route.",
    confidence: 0.86,
  },
  {
    id: "exc-008",
    type: "date_ambiguity",
    severity: "warning",
    summary: "Agreement A-03102: date '01/02/23' could be Jan 2 or Feb 1",
    evidence: ["RoutePro date field: 01/02/23", "QuickBooks contract start: 2023-01-02", "Legacy format used MM/DD/YYYY, but source file was imported with mixed formats"],
    suggestedFix: "Confirm with customer: contract start date on file is Jan 2, 2023.",
    confidence: 0.75,
  },
];

interface AggregatedGroup {
  type: string;
  count: number;
  severity: "critical" | "warning" | "info";
}

const AGGREGATED: AggregatedGroup[] = [
  { type: "duplicate_customer", count: 412, severity: "warning" },
  { type: "date_ambiguity", count: 308, severity: "warning" },
  { type: "orphan_container", count: 245, severity: "warning" },
  { type: "unmappable_code", count: 198, severity: "warning" },
  { type: "closed_unbilled", count: 120, severity: "info" },
  { type: "ungeocodable", count: 98, severity: "info" },
  { type: "pricing_conflict", count: 67, severity: "critical" },
  { type: "unmatched_ticket", count: 45, severity: "info" },
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "text-red-400 border-red-600/60",
  warning: "text-amber-400 border-amber-600/50",
  info: "text-zinc-400 border-zinc-700",
};

const TOTAL_AGGREGATED = AGGREGATED.reduce((sum, g) => sum + g.count, 0);

export function ExceptionReviewView() {
  const advance = useDemoStore((s) => s.advance);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [bulkResolved, setBulkResolved] = useState(false);

  const allFeaturedResolved = resolved.size === FEATURED.length;
  const allDone = allFeaturedResolved && bulkResolved;

  const resolve = (id: string) => {
    setResolved((prev) => new Set([...prev, id]));
  };

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800/60 px-5 py-2.5">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            TrashLab Migration Cockpit
          </h1>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            Exception Review
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Featured</span>
            <p className="font-mono text-xs tabular-nums text-zinc-300">{resolved.size}/{FEATURED.length}</p>
          </div>
          <div className="text-right">
            <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">Aggregated</span>
            <p className="font-mono text-xs tabular-nums text-amber-400">{bulkResolved ? "0" : formatCount(TOTAL_AGGREGATED)}</p>
          </div>
          {allDone && (
            <button
              onClick={advance}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-emerald-400"
            >
              View Report
              <span aria-hidden>{"->"}</span>
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {/* Featured exceptions */}
          <div className="mb-8">
            <h2 className="mb-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
              Featured Exceptions ({FEATURED.length})
            </h2>
            <div className="space-y-4">
              {FEATURED.map((exc) => {
                const isResolved = resolved.has(exc.id);
                return (
                  <div
                    key={exc.id}
                    className={`rounded-lg border p-4 transition-all ${
                      isResolved
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-zinc-800 bg-zinc-900/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className={`font-mono text-[10px] uppercase tracking-wider ${SEVERITY_COLORS[exc.severity].split(" ")[0]}`}>
                          {exc.type}
                        </span>
                        <p className="mt-1 text-sm font-medium text-zinc-100">{exc.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[10px] tabular-nums text-zinc-600">
                          {exc.confidence.toFixed(2)}
                        </span>
                        {isResolved ? (
                          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400">approved</span>
                        ) : (
                          <button
                            onClick={() => resolve(exc.id)}
                            className="rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-emerald-400 transition-all hover:bg-emerald-500/20"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>
                    {!isResolved && (
                      <>
                        <ul className="mt-3 space-y-1">
                          {exc.evidence.map((item, i) => (
                            <li key={i} className="font-mono text-[11px] leading-5 text-zinc-500">
                              {item}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 text-xs text-zinc-400">
                          <span className="text-zinc-600">Fix:</span> {exc.suggestedFix}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aggregated exceptions */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
                Aggregated by Type ({formatCount(TOTAL_AGGREGATED)})
              </h2>
              {!bulkResolved && allFeaturedResolved && (
                <button
                  onClick={() => setBulkResolved(true)}
                  className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-amber-400 transition-all hover:bg-amber-500/20"
                >
                  Bulk Resolve All
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-800/60">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/60">
                    <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-zinc-600">Type</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Count</th>
                    <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider text-zinc-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {AGGREGATED.map((group) => (
                    <tr key={group.type} className="border-b border-zinc-800/40 last:border-0">
                      <td className={`px-4 py-2.5 font-mono text-xs ${SEVERITY_COLORS[group.severity].split(" ")[0]}`}>
                        {group.type}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-zinc-300">
                        {formatCount(group.count)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-wider">
                        {bulkResolved ? (
                          <span className="text-emerald-400">resolved</span>
                        ) : (
                          <span className="text-zinc-600">open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 font-mono text-[10px] text-zinc-700">
              All aggregated exceptions share the same pattern as their featured counterpart. Bulk resolution applies the suggested fix from the featured case.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}