import { describe, expect, it, beforeEach } from "vitest";
import { useDemoStore, PHASE_LABELS } from "@/components/demo/demo-store";

describe("demo-store", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
  });

  it("starts on landing phase", () => {
    expect(useDemoStore.getState().phase).toBe("landing");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });

  it("startDemo sets phase to file-drop", () => {
    useDemoStore.getState().startDemo();
    expect(useDemoStore.getState().phase).toBe("file-drop");
    expect(useDemoStore.getState().isRunning).toBe(true);
  });

  it("advance moves through all phases in order", () => {
    const { advance } = useDemoStore.getState();
    advance(); // landing -> file-drop
    expect(useDemoStore.getState().phase).toBe("file-drop");
    advance(); // file-drop -> live-sample
    expect(useDemoStore.getState().phase).toBe("live-sample");
    advance(); // live-sample -> full-batch
    expect(useDemoStore.getState().phase).toBe("full-batch");
    advance(); // full-batch -> exception-review
    expect(useDemoStore.getState().phase).toBe("exception-review");
    advance(); // exception-review -> report
    expect(useDemoStore.getState().phase).toBe("report");
  });

  it("advance stays on report at the end", () => {
    useDemoStore.getState().goTo("report");
    useDemoStore.getState().advance();
    expect(useDemoStore.getState().phase).toBe("report");
  });

  it("goTo jumps to a specific phase", () => {
    useDemoStore.getState().goTo("exception-review");
    expect(useDemoStore.getState().phase).toBe("exception-review");
    expect(useDemoStore.getState().isRunning).toBe(true);
  });

  it("reset returns to landing", () => {
    useDemoStore.getState().goTo("report");
    useDemoStore.getState().reset();
    expect(useDemoStore.getState().phase).toBe("landing");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });

  it("PHASE_LABELS has all 6 phases", () => {
    const phases = Object.keys(PHASE_LABELS);
    expect(phases).toHaveLength(6);
    expect(phases).toContain("landing");
    expect(phases).toContain("file-drop");
    expect(phases).toContain("live-sample");
    expect(phases).toContain("full-batch");
    expect(phases).toContain("exception-review");
    expect(phases).toContain("report");
  });

  it("goTo to landing sets isRunning to false", () => {
    useDemoStore.getState().goTo("report");
    expect(useDemoStore.getState().isRunning).toBe(true);
    useDemoStore.getState().goTo("landing");
    expect(useDemoStore.getState().isRunning).toBe(false);
  });
});