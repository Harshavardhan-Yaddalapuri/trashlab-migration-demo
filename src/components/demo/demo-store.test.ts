import { describe, expect, it, beforeEach } from "vitest";
import { useDemoStore, PHASE_TO_PATH, PATH_TO_PHASE, phaseFromPath } from "@/components/demo/demo-store";

describe("demo-store", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
  });

  it("starts on landing phase", () => {
    expect(useDemoStore.getState().phase).toBe("landing");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });

  it("syncFromPath maps each URL to the right phase", () => {
    const { syncFromPath } = useDemoStore.getState();
    syncFromPath("/");
    expect(useDemoStore.getState().phase).toBe("landing");
    syncFromPath("/migrate");
    expect(useDemoStore.getState().phase).toBe("file-drop");
    syncFromPath("/migrate/live");
    expect(useDemoStore.getState().phase).toBe("live-sample");
    syncFromPath("/migrate/batch");
    expect(useDemoStore.getState().phase).toBe("full-batch");
    syncFromPath("/migrate/review");
    expect(useDemoStore.getState().phase).toBe("exception-review");
    syncFromPath("/migrate/report");
    expect(useDemoStore.getState().phase).toBe("report");
  });

  it("syncFromPath sets isRunning for non-landing phases", () => {
    useDemoStore.getState().syncFromPath("/migrate");
    expect(useDemoStore.getState().isRunning).toBe(true);
    useDemoStore.getState().syncFromPath("/");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });

  it("syncFromPath falls back to landing for unknown paths", () => {
    useDemoStore.getState().syncFromPath("/migrate/report");
    useDemoStore.getState().syncFromPath("/totally-unknown");
    expect(useDemoStore.getState().phase).toBe("landing");
  });

  it("markRunning sets isRunning true", () => {
    useDemoStore.getState().markRunning();
    expect(useDemoStore.getState().isRunning).toBe(true);
  });

  it("reset returns to landing", () => {
    useDemoStore.getState().syncFromPath("/migrate/report");
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().phase).toBe("landing");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });

  it("PHASE_TO_PATH has all 6 phases", () => {
    const phases = Object.keys(PHASE_TO_PATH);
    expect(phases).toHaveLength(6);
    expect(phases).toContain("landing");
    expect(phases).toContain("file-drop");
    expect(phases).toContain("live-sample");
    expect(phases).toContain("full-batch");
    expect(phases).toContain("exception-review");
    expect(phases).toContain("report");
  });

  it("PATH_TO_PHASE round-trips with PHASE_TO_PATH", () => {
    for (const [phase, path] of Object.entries(PHASE_TO_PATH)) {
      expect(PATH_TO_PHASE[path]).toBe(phase);
    }
  });

  it("phaseFromPath returns landing for unknown", () => {
    expect(phaseFromPath("/nope")).toBe("landing");
  });
});
