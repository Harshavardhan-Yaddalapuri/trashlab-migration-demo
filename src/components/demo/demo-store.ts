"use client";

/**
 * Demo store. The URL is the single source of truth for the demo phase.
 * Each phase maps to a real route:
 *   /                    -> landing
 *   /migrate             -> file-drop
 *   /migrate/live        -> live-sample
 *   /migrate/batch       -> full-batch
 *   /migrate/review      -> exception-review
 *   /migrate/report      -> report
 *
 * The store keeps a small amount of UI state (isRunning) and exposes
 * navigation helpers that push real URLs, so browser back/forward and
 * deep links work.
 */

import { create } from "zustand";

export type DemoPhase =
  | "landing"
  | "file-drop"
  | "live-sample"
  | "full-batch"
  | "exception-review"
  | "report";

export const PHASE_TO_PATH: Record<DemoPhase, string> = {
  landing: "/",
  "file-drop": "/migrate",
  "live-sample": "/migrate/live",
  "full-batch": "/migrate/batch",
  "exception-review": "/migrate/review",
  report: "/migrate/report",
};

export const PATH_TO_PHASE: Record<string, DemoPhase> = {
  "/": "landing",
  "/migrate": "file-drop",
  "/migrate/live": "live-sample",
  "/migrate/batch": "full-batch",
  "/migrate/review": "exception-review",
  "/migrate/report": "report",
};

export function phaseFromPath(pathname: string): DemoPhase {
  return PATH_TO_PHASE[pathname] ?? "landing";
}

interface DemoState {
  phase: DemoPhase;
  isRunning: boolean;
  /** The real migration job created from uploaded files, if the API is reachable. */
  jobId: string | null;
  /** Set the phase from the current URL (called by the router-driven shell). */
  syncFromPath: (pathname: string) => void;
  /** Mark the demo as running (used by the landing CTA before navigation). */
  markRunning: () => void;
  /** Store the real job ID returned by the migration-jobs API. */
  setJobId: (jobId: string | null) => void;
  /** Reset back to the landing page. */
  reset: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  phase: "landing",
  isRunning: false,
  jobId: null,
  syncFromPath: (pathname) =>
    set({ phase: phaseFromPath(pathname), isRunning: phaseFromPath(pathname) !== "landing" }),
  markRunning: () => set({ isRunning: true }),
  setJobId: (jobId) => set({ jobId }),
  reset: () => set({ phase: "landing", isRunning: false, jobId: null }),
}));
