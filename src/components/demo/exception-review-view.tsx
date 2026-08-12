"use client";

/**
 * Exception review view. Shows 8 featured exceptions with evidence
 * and suggested fixes, plus the 1,493 aggregated by type with bulk-resolve.
 * User can approve individual exceptions and then advance to the report.
 *
 * Light theme, TrashLab design language, shared header with back nav.
 * Evidence is expandable, approve shows what you are approving,
 * aggregated rows drill into the records behind the count.
 * No em-dashes in user-facing text.
 */

import { useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { CockpitHeader } from "@/components/cockpit/cockpit-header";
import { formatCount } from "@/components/ui/format";
import { useRouter } from "next/navigation";

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
    evidence: ["Customer C-00231: Summit Construction LLC, 412 Industrial Pkwy, +131****0123", "Customer C-00892: S. Construction, 412 Industrial Pkwy, +131****0123", "Same billing contact: John Reyes"],
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
  sample: string[];
}

const AGGREGATED: AggregatedGroup[] = [
  { type: "duplicate_customer", count: 412, severity: "warning", sample: ["C-00231 vs C-00892 (Summit Construction LLC / S. Construction)", "C-01120 vs C-01121 (Apex Disposal Inc / Apex Disposal)", "C-04510 vs C-04511 (Blue Ridge Waste / Blue Ridge Waste LLC)"] },
  { type: "date_ambiguity", count: 308, severity: "warning", sample: ["A-03102: 01/02/23 (Jan 2 or Feb 1?)", "A-03115: 03/04/23 (Mar 4 or Apr 3?)", "A-03188: 11/12/23 (Nov 12 or Dec 11?)"] },
  { type: "orphan_container", count: 245, severity: "warning", sample: ["RC-33109: no site assignment", "RC-33110: no site assignment", "RC-33112: no site assignment"] },
  { type: "unmappable_code", count: 198, severity: "warning", sample: ["NOPE-1 on A-08992", "SW-OLD-2YD on A-09001", "FR-UNK on A-09012"] },
  { type: "closed_unbilled", count: 120, severity: "info", sample: ["A-01567: closed 2026-03-01, unbilled", "A-01568: closed 2026-03-01, unbilled", "A-01570: closed 2026-03-05, unbilled"] },
  { type: "ungeocodable", count: 98, severity: "info", sample: ["S-04823: PO Box 1142", "S-04824: PO Box 1143", "S-04825: PO Box 1144"] },
  { type: "pricing_conflict", count: 67, severity: "critical", sample: ["A-04231: $300 vs $450 (RC-1023)", "A-04232: $280 vs $420 (RC-1024)", "A-04233: $310 vs $460 (RC-1025)"] },
  { type: "unmatched_ticket", count: 45, severity: "info", sample: ["T-09231: 4.2 tons, no link", "T-09232: 3.8 tons, no link", "T-09233: 5.1 tons, no link"] },
];

const SEVERITY_STYLES: Record<string, { text: string; badge: string }> = {
  critical: { text: "text-red-600", badge: "bg-red-50 text-red-600 border-red-200" },
  warning: { text: "text-amber-600", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  info: { text: "text-slate-500", badge: "bg-slate-50 text-slate-500 border-slate-200" },
};

const TOTAL_AGGREGATED = AGGREGATED.reduce((sum, g) => sum + g.count, 0);

export function ExceptionReviewView() {
  const router = useRouter();
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [bulkResolved, setBulkResolved] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<AggregatedGroup | null>(null);

  const allFeaturedResolved = resolved.size === FEATURED.length;
  const allDone = allFeaturedResolved && bulkResolved;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolve = (id: string) => {
    setResolved((prev) => new Set([...prev, id]));
    setConfirming(null);
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      <CockpitHeader
        phaseLabel="Exception Review"
        status={{ label: allDone ? "all resolved" : "reviewing", active: !allDone }}
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Featured</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{resolved.size}/{FEATURED.length}</p>
            </div>
            <div className="text-right">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-white/50">Aggregated</span>
              <p className="font-mono text-xs tabular-nums text-white/90">{bulkResolved ? "0" : formatCount(TOTAL_AGGREGATED)}</p>
            </div>
            {allDone && (
              <button
                onClick={() => router.push("/migrate/report")}
                className="inline-flex items-center gap-2 rounded-full bg-[#10b981] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#0d9a6c]"
              >
                View Report
                <span aria-hidden>{"->"}</span>
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          {/* Featured exceptions */}
          <div className="mb-8">
            <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Featured Exceptions ({FEATURED.length})
            </h2>
            <div className="space-y-4">
              {FEATURED.map((exc) => {
                const isResolved = resolved.has(exc.id);
                const isExpanded = expanded.has(exc.id);
                const isConfirming = confirming === exc.id;
                const sev = SEVERITY_STYLES[exc.severity];
                return (
                  <div
                    key={exc.id}
                    className={`rounded-2xl border p-5 transition-all ${
                      isResolved
                        ? "border-[#10b981]/30 bg-[#10b981]/5"
                        : "border-[#e0deff] bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${sev.badge}`}>
                            {exc.type}
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-[#6260af]">
                            confidence {exc.confidence.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-slate-800">{exc.summary}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isResolved ? (
                          <span className="rounded-full bg-[#10b981]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#10b981]">
                            approved
                          </span>
                        ) : isConfirming ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => resolve(exc.id)}
                              className="rounded-full bg-[#10b981] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#0d9a6c]"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirming(null)}
                              className="rounded-full border border-[#e0deff] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6260af] transition-colors hover:bg-[#f7f7ff]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirming(exc.id)}
                            className="rounded-full bg-[#312d97] px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-all hover:bg-[#5149d7]"
                          >
                            Approve
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Evidence — expandable */}
                    {!isResolved && (
                      <div className="mt-3">
                        <button
                          onClick={() => toggleExpand(exc.id)}
                          className="text-xs font-medium text-[#5149d7] hover:text-[#312d97]"
                        >
                          {isExpanded ? "Hide evidence" : "Show evidence"}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 rounded-xl border border-[#e0deff] bg-[#f7f7ff] p-4">
                            <ul className="space-y-1.5">
                              {exc.evidence.map((item, i) => (
                                <li key={i} className="font-mono text-[11px] leading-5 text-slate-600">
                                  {item}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-3 text-xs text-slate-700">
                              <span className="font-semibold text-[#6260af]">Suggested fix:</span> {exc.suggestedFix}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Aggregated exceptions */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
                Aggregated by Type ({formatCount(TOTAL_AGGREGATED)})
              </h2>
              {!bulkResolved && allFeaturedResolved && (
                <button
                  onClick={() => setBulkResolved(true)}
                  className="rounded-full border border-[#10b981]/40 bg-[#10b981]/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#10b981] transition-all hover:bg-[#10b981]/20"
                >
                  Bulk Resolve All
                </button>
              )}
            </div>
            <div className="overflow-hidden rounded-2xl border border-[#e0deff]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#e0deff] bg-[#f7f7ff]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Type</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Count</th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {AGGREGATED.map((group) => {
                    const sev = SEVERITY_STYLES[group.severity];
                    return (
                      <tr
                        key={group.type}
                        onClick={() => setDrillDown(group)}
                        className="cursor-pointer border-b border-[#e0deff] last:border-0 transition-colors hover:bg-[#f7f7ff]"
                      >
                        <td className={`px-4 py-2.5 font-mono text-xs ${sev.text}`}>
                          {group.type}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs tabular-nums text-slate-700">
                          {formatCount(group.count)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider">
                          {bulkResolved ? (
                            <span className="text-[#10b981]">resolved</span>
                          ) : (
                            <span className="text-[#6260af]">open</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[#6260af]">
              Click a row to see the records behind the count. All aggregated exceptions share the same pattern as their featured counterpart.
            </p>
          </div>
        </div>
      </div>

      {/* Drill-down modal */}
      {drillDown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={() => setDrillDown(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-[#e0deff] bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_STYLES[drillDown.severity].badge}`}>
                  {drillDown.type}
                </span>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {formatCount(drillDown.count)} records
                </h3>
              </div>
              <button
                onClick={() => setDrillDown(null)}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600">
              Sample of the records in this group:
            </p>
            <ul className="space-y-2">
              {drillDown.sample.map((s, i) => (
                <li key={i} className="rounded-lg border border-[#e0deff] bg-[#f7f7ff] px-3 py-2 font-mono text-[11px] text-slate-700">
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDrillDown(null)}
                className="rounded-full border border-[#e0deff] px-5 py-2 text-xs font-semibold text-[#6260af] transition-colors hover:bg-[#f7f7ff]"
              >
                Close
              </button>
              {!bulkResolved && (
                <button
                  onClick={() => { setBulkResolved(true); setDrillDown(null); }}
                  className="rounded-full bg-[#312d97] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[#5149d7]"
                >
                  Resolve this type
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
