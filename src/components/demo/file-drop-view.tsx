"use client";

/**
 * File-drop view. A REAL interactive drop zone:
 * - Empty state with click-to-upload and drag-drop
 * - Files appear as cards with remove buttons
 * - "Start Migration" enables only when files are present
 * - Fleet activation strip after start
 *
 * Styled to match TrashLab's design language (light, indigo/cyan).
 * No em-dashes in user-facing text.
 */

import { useRef, useState } from "react";
import { useDemoStore } from "@/components/demo/demo-store";
import { formatCount } from "@/components/ui/format";

interface DropFile {
  name: string;
  kind: string;
  records: number;
}

const SAMPLE_FILES: DropFile[] = [
  { name: "routepro_2019_export.csv", kind: "RoutePro CSV", records: 78_000 },
  { name: "quickbooks_customer_export.tsv", kind: "QuickBooks", records: 45_000 },
  { name: "transfer_station_weights.xlsx", kind: "Transfer Station", records: 20_000 },
  { name: "legacy_paper_export.tab", kind: "Legacy Export", records: 7_000 },
];

const AGENTS = ["Orchestrator", "Intake", "Normalizer", "Resolver", "Mapper", "Validator", "Trainer", "Eval"];

export function FileDropView() {
  const advance = useDemoStore((s) => s.advance);
  const [files, setFiles] = useState<DropFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [started, setStarted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFile = (file: DropFile) => {
    setFiles((prev) => (prev.some((f) => f.name === file.name) ? prev : [...prev, file]));
  };

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    // Simulate: any dropped file becomes a recognized source (demo uses the 4 known sources)
    const dropped = e.dataTransfer.files;
    if (dropped.length > 0) {
      // Map dropped filenames to known sources when they match, else generic
      const names = Array.from(dropped).map((f) => f.name.toLowerCase());
      SAMPLE_FILES.forEach((sf) => {
        if (names.some((n) => sf.name.toLowerCase().includes(n.split("_")[0]) || n === sf.name.toLowerCase())) {
          addFile(sf);
        }
      });
      // If nothing matched, add the first sample file so the demo can proceed
      if (files.length === 0) {
        addFile(SAMPLE_FILES[0]);
      }
    }
  };

  const totalRecords = files.reduce((sum, f) => sum + f.records, 0);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Header — dark indigo with TrashLab logo */}
      <header className="flex shrink-0 items-center justify-between bg-[#1a174f] px-6 py-3">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/trashlab-logo.svg" alt="TrashLab" className="h-6 w-auto" />
          <span className="text-sm font-semibold tracking-tight text-white/90">
            Migration Cockpit
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/70">
            File Drop
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${started ? "bg-[#10b981] cockpit-pulse" : "bg-white/30"}`} aria-hidden />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
            {started ? "fleet active" : "ready"}
          </span>
        </div>
      </header>

      {/* Drop zone */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-3xl">
          {/* Drop target */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`mb-8 cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
              isDragging
                ? "border-[#10a6cc] bg-[#ecebff]"
                : files.length > 0
                  ? "border-[#10b981]/40 bg-[#f7f7ff]"
                  : "border-[#e0deff] bg-[#f7f7ff] hover:border-[#10a6cc]"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const dropped = e.target.files;
                if (dropped && dropped.length > 0) {
                  const names = Array.from(dropped).map((f) => f.name.toLowerCase());
                  SAMPLE_FILES.forEach((sf) => {
                    if (names.some((n) => n === sf.name.toLowerCase() || n.includes(sf.name.split("_")[0]))) {
                      addFile(sf);
                    }
                  });
                  if (files.length === 0) {
                    addFile(SAMPLE_FILES[0]);
                  }
                }
              }}
            />
            {files.length === 0 ? (
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5149d7]">
                  Drop Source Files Here
                </p>
                <p className="text-sm text-slate-500">
                  Click to browse, or drag your legacy exports in. RoutePro, QuickBooks, transfer-station logs, paper-era exports.
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10b981]">
                  Files Received
                </p>
                <div className="space-y-3 text-left">
                  {files.map((file) => (
                    <div
                      key={file.name}
                      className="flex items-center justify-between rounded-xl border border-[#e0deff] bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-[#10b981]" aria-hidden />
                        <span className="text-sm font-medium text-slate-800">{file.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#6260af]">
                          {file.kind}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-slate-600">
                          {formatCount(file.records)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                          className="rounded-full p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label={`Remove ${file.name}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-[#e0deff] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6260af]">
                      Total Records
                    </span>
                    <span className="font-mono text-lg font-bold tabular-nums text-[#10b981]">
                      {formatCount(totalRecords)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          {files.length > 0 && !started && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => { setStarted(true); }}
                className="inline-flex items-center gap-2 rounded-full bg-[#312d97] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
              >
                Start Migration
                <span aria-hidden>{"->"}</span>
              </button>
              <button
                onClick={() => setFiles([])}
                className="rounded-full border border-[#e0deff] px-6 py-3 text-sm font-medium text-[#6260af] transition-colors hover:bg-[#f7f7ff]"
              >
                Clear
              </button>
            </div>
          )}

          {/* Fleet activation */}
          {started && (
            <div className="text-center">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#10b981]">
                Fleet Activated
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {AGENTS.map((agent) => (
                  <span
                    key={agent}
                    className="flex items-center gap-1.5 rounded-full border border-[#10b981]/30 bg-[#10b981]/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#10b981]"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] cockpit-pulse" aria-hidden />
                    {agent}
                  </span>
                ))}
              </div>
              <button
                onClick={advance}
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#312d97] px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-[#5149d7]"
              >
                Watch the pipeline run
                <span aria-hidden>{"->"}</span>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
