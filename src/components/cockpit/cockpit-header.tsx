"use client";

/**
 * Shared cockpit header. Dark indigo TrashLab bar with logo,
 * optional back button, phase label, and right-side status slot.
 * No em-dashes in user-facing text.
 */

import { useDemoStore } from "@/components/demo/demo-store";

interface CockpitHeaderProps {
  phaseLabel: string;
  status?: { label: string; active?: boolean };
  right?: React.ReactNode;
  onBack?: () => void;
}

export function CockpitHeader({ phaseLabel, status, right, onBack }: CockpitHeaderProps) {
  const reset = useDemoStore((s) => s.reset);

  const handleBack = onBack ?? reset;

  return (
    <header className="flex shrink-0 items-center justify-between bg-[#1a174f] px-6 py-3">
      <div className="flex items-center gap-4">
        {onBack !== undefined && (
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20"
            aria-label="Go back"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/trashlab-logo.svg" alt="TrashLab" className="h-6 w-auto" />
        <span className="text-sm font-semibold tracking-tight text-white/90">
          Migration Cockpit
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
          {phaseLabel}
        </span>
      </div>
      <div className="flex items-center gap-4">
        {status && (
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${status.active ? "bg-[#10b981] cockpit-pulse" : "bg-white/30"}`}
              aria-hidden
            />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
              {status.label}
            </span>
          </div>
        )}
        {right}
      </div>
    </header>
  );
}
