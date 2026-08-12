"use client";

/**
 * Full detail for one real record: every canonical field plus its
 * annotations (real exceptions, plain language). Config-driven so it
 * works for any entity type.
 */

import type { EntityRecord } from "@/lib/api";
import type { EntityConfig } from "@/components/workspace/entity-config";
import { AnnotationCard } from "@/components/workspace/annotation-card";

interface EntityDetailPanelProps {
  jobId: string;
  config: EntityConfig;
  record: EntityRecord;
  onClose: () => void;
  onAnnotationResolved: () => void;
}

export function EntityDetailPanel({ jobId, config, record, onClose, onAnnotationResolved }: EntityDetailPanelProps) {
  const openExceptions = record.exceptions.filter((e) => e.reviewStatus === "open");
  const resolvedExceptions = record.exceptions.filter((e) => e.reviewStatus !== "open");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e0deff] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-slate-900">{config.singularLabel} details</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3">
          {config.detailFields.map((f) => {
            const value = f.render ? f.render(record) : (record.fields[f.key] ?? "");
            if (!value) return null;
            return (
              <div key={f.key}>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">{f.label}</dt>
                <dd className="mt-0.5 text-sm text-slate-800">{value}</dd>
              </div>
            );
          })}
        </dl>

        {openExceptions.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Needs your attention ({openExceptions.length})
            </h4>
            <div className="space-y-3">
              {openExceptions.map((exc) => (
                <AnnotationCard key={exc.id} jobId={jobId} exception={exc} onResolved={onAnnotationResolved} />
              ))}
            </div>
          </div>
        )}

        {resolvedExceptions.length > 0 && (
          <div>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6260af]">
              Resolved ({resolvedExceptions.length})
            </h4>
            <div className="space-y-3">
              {resolvedExceptions.map((exc) => (
                <AnnotationCard key={exc.id} jobId={jobId} exception={exc} onResolved={onAnnotationResolved} />
              ))}
            </div>
          </div>
        )}

        {record.exceptions.length === 0 && (
          <p className="text-sm text-slate-500">No issues found on this record.</p>
        )}
      </div>
    </div>
  );
}
