import { create } from "zustand";
import type { ExceptionIssue, MigrationStatus } from "@/lib/types";

export interface CockpitState {
  status: MigrationStatus;
  progress: number;
  exceptions: ExceptionIssue[];
  setStatus: (status: MigrationStatus) => void;
  setProgress: (progress: number) => void;
  setExceptions: (exceptions: ExceptionIssue[]) => void;
  approveException: (id: string) => void;
  rejectException: (id: string) => void;
}

export const useCockpitStore = create<CockpitState>((set) => ({
  status: "pending",
  progress: 0,
  exceptions: [],
  setStatus: (status) => set({ status }),
  setProgress: (progress) => set({ progress }),
  setExceptions: (exceptions) => set({ exceptions }),
  approveException: (id) =>
    set((state) => ({
      exceptions: state.exceptions.map((e) =>
        e.id === id ? { ...e, reviewStatus: "approved" } : e,
      ),
    })),
  rejectException: (id) =>
    set((state) => ({
      exceptions: state.exceptions.map((e) =>
        e.id === id ? { ...e, reviewStatus: "rejected" } : e,
      ),
    })),
}));
