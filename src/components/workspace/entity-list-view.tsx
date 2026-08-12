"use client";

/**
 * Real, paginated list of one entity type's records, config-driven. Rows
 * with open exceptions show a "needs attention" badge. Clicking a row
 * opens the full detail panel. Loading and error states are real -- a
 * failed fetch shows a retry button, never fabricated data.
 */

import { useEffect, useState } from "react";
import { getJobEntities } from "@/lib/api";
import type { EntityRecord } from "@/lib/api";
import type { EntityConfig } from "@/components/workspace/entity-config";
import { EntityDetailPanel } from "@/components/workspace/entity-detail-panel";

type LoadState = "loading" | "ready" | "error";

interface EntityListViewProps {
  jobId: string;
  config: EntityConfig;
}

export function EntityListView({ jobId, config }: EntityListViewProps) {
  const [items, setItems] = useState<EntityRecord[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<EntityRecord | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // The fetch lives inside the effect (not a component-level function
  // called from it) so this is the one canonical "load on mount" path;
  // `retryToken` is bumped to intentionally re-run it.
  useEffect(() => {
    let cancelled = false;
    const fetchInitialPage = async () => {
      const page = await getJobEntities(jobId, config.entityType, null);
      if (cancelled) return;
      if (page === null) {
        setLoadState("error");
        return;
      }
      setItems(page.items);
      setCursor(page.nextCursor);
      setLoadState("ready");
    };
    void fetchInitialPage();
    return () => {
      cancelled = true;
    };
    // Parent remounts this component (via `key`) when jobId/entityType
    // change, so this only needs to depend on the explicit retry token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  const retry = () => {
    setLoadState("loading");
    setRetryToken((t) => t + 1);
  };

  const loadMore = async () => {
    setLoadingMore(true);
    const page = await getJobEntities(jobId, config.entityType, cursor);
    if (page !== null) {
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    }
    setLoadingMore(false);
  };

  const refreshSelected = async () => {
    // Re-fetch so the annotation's resolved status sticks after approve/reject.
    const page = await getJobEntities(jobId, config.entityType, null);
    if (page !== null) {
      setItems(page.items);
      setCursor(page.nextCursor);
    }
  };

  if (loadState === "loading") {
    return (
      <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-8 text-center text-sm text-[#6260af]">
        Loading {config.label.toLowerCase()}...
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-sm text-red-600">Couldn&apos;t load {config.label.toLowerCase()} right now.</p>
        <button
          onClick={retry}
          className="mt-3 rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-[#e0deff] bg-[#f7f7ff] p-8 text-center text-sm text-[#6260af]">
        No {config.label.toLowerCase()} in this migration.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-[#e0deff]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#e0deff] bg-[#f7f7ff]">
              {config.columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((record) => {
              const openCount = record.exceptions.filter((e) => e.reviewStatus === "open").length;
              return (
                <tr
                  key={record.id}
                  onClick={() => setSelected(record)}
                  className="cursor-pointer border-b border-[#e0deff] last:border-0 transition-colors hover:bg-[#f7f7ff]"
                >
                  {config.columns.map((col) => (
                    <td key={col.key} className="px-4 py-2.5 text-xs text-slate-700">
                      {col.render ? col.render(record) : (record.fields[col.key] ?? "")}
                    </td>
                  ))}
                  <td className="px-4 py-2.5 text-right">
                    {openCount > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                        Needs attention
                      </span>
                    ) : (
                      <span className="rounded-full border border-[#10b981]/30 bg-[#10b981]/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#10b981]">
                        Clean
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cursor && (
        <div className="mt-4 text-center">
          <button
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="rounded-full border border-[#e0deff] px-5 py-2 text-xs font-semibold text-[#6260af] transition-colors hover:bg-[#f7f7ff] disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {selected && (
        <EntityDetailPanel
          jobId={jobId}
          config={config}
          record={selected}
          onClose={() => setSelected(null)}
          onAnnotationResolved={() => void refreshSelected()}
        />
      )}
    </>
  );
}
