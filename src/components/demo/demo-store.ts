/**
 * Zustand store for the 90-second demo flow.
 * Paces: landing -> file-drop -> live-sample -> full-batch -> exception-review -> report.
 * Each phase transition is manual (click) or auto-advance via startDemo().
 * The store is the single source of truth for which view to render.
 */

import { create } from "zustand";

/** The phases of the demo flow, in order. */
export type DemoPhase =
  | "landing"
  | "file-drop"
  | "live-sample"
  | "full-batch"
  | "exception-review"
  | "report";

/** Ordered list of phases for sequential advance. */
const PHASE_ORDER: DemoPhase[] = [
  "landing",
  "file-drop",
  "live-sample",
  "full-batch",
  "exception-review",
  "report",
];

interface DemoState {
  phase: DemoPhase;
  /** True when the demo is actively running (vs manually navigating). */
  isRunning: boolean;
  /** Advance to the next phase in the ordered list. */
  advance: () => void;
  /** Jump to a specific phase. */
  goTo: (phase: DemoPhase) => void;
  /** Start the demo from the beginning (file-drop). */
  startDemo: () => void;
  /** Reset back to the landing page. */
  reset: () => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  phase: "landing",
  isRunning: false,
  advance: () =>
    set((state) => {
      const idx = PHASE_ORDER.indexOf(state.phase);
      const next = idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : state.phase;
      return { phase: next, isRunning: next !== "landing" };
    }),
  goTo: (phase) => set({ phase, isRunning: phase !== "landing" }),
  startDemo: () => set({ phase: "file-drop", isRunning: true }),
  reset: () => set({ phase: "landing", isRunning: false }),
}));

/** Phase metadata for display. */
export const PHASE_LABELS: Record<DemoPhase, string> = {
  landing: "Start",
  "file-drop": "File Drop",
  "live-sample": "Live Sample",
  "full-batch": "Full Batch",
  "exception-review": "Exception Review",
  report: "Report",
};