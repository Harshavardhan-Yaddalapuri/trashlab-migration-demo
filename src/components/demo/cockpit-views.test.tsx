import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { LiveSampleView } from "@/components/demo/live-sample-view";
import { FullBatchView } from "@/components/demo/full-batch-view";

describe("LiveSampleView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().syncFromPath("/migrate/live");
  });

  it("renders the live sample header", () => {
    render(<LiveSampleView />);
    expect(screen.getByText(/Live Sample/i)).toBeInTheDocument();
  });

  it("renders 500 records count in header", () => {
    render(<LiveSampleView />);
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders source systems pane", () => {
    render(<LiveSampleView />);
    expect(screen.getByText("Source Systems")).toBeInTheDocument();
  });

  it("renders pipeline pane", () => {
    render(<LiveSampleView />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it("renders exception queue pane", () => {
    render(<LiveSampleView />);
    expect(screen.getByText("Exception Queue")).toBeInTheDocument();
  });
});

describe("FullBatchView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().syncFromPath("/migrate/batch");
  });

  it("renders the full batch header", () => {
    render(<FullBatchView />);
    expect(screen.getByText(/Full Batch/i)).toBeInTheDocument();
  });

  it("renders 150,000 records in header", () => {
    render(<FullBatchView />);
    // 150,000 appears in header count + source systems footer
    expect(screen.getAllByText("150,000").length).toBeGreaterThanOrEqual(1);
  });

  it("renders source systems pane", () => {
    render(<FullBatchView />);
    expect(screen.getByText("Source Systems")).toBeInTheDocument();
  });

  it("renders pipeline pane", () => {
    render(<FullBatchView />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it("renders exception queue pane", () => {
    render(<FullBatchView />);
    expect(screen.getByText("Exception Queue")).toBeInTheDocument();
  });

  it("renders pipeline events", () => {
    render(<FullBatchView />);
    expect(screen.getByText("SourceParsed")).toBeInTheDocument();
  });
});