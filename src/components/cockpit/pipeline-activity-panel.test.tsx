import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PipelineActivityPanel } from "@/components/cockpit/pipeline-activity-panel";
import type { AgentStage, PipelineEvent } from "@/components/cockpit/types";

const stages: AgentStage[] = [
  {
    id: "intake",
    label: "Intake",
    status: "ingesting",
    progress: 1,
    processed: 150_000,
    total: 150_000,
    throughput: 32_000,
    phase: "done",
  },
  {
    id: "map",
    label: "Map",
    status: "mapping",
    progress: 0.92,
    processed: 138_000,
    total: 150_000,
    throughput: 9_500,
    phase: "active",
  },
  {
    id: "validate",
    label: "Validate",
    status: "validating",
    progress: 0,
    processed: 0,
    total: 150_000,
    throughput: 0,
    phase: "waiting",
  },
];

const events: PipelineEvent[] = [
  {
    id: "evt-1",
    stageId: "intake",
    type: "SourceParsed",
    message: "Parsed 4 source files, 150,000 records",
    at: "2026-08-12T04:01:12.000Z",
    level: "info",
  },
  {
    id: "evt-2",
    stageId: "map",
    type: "ExceptionRaised",
    message: "Pricing conflict on agreement A-04231",
    at: "2026-08-12T04:01:37.000Z",
    level: "warn",
  },
];

describe("PipelineActivityPanel", () => {
  it("renders stage labels", () => {
    render(<PipelineActivityPanel stages={stages} events={events} />);
    expect(screen.getByText("Intake")).toBeInTheDocument();
    expect(screen.getByText("Map")).toBeInTheDocument();
    expect(screen.getByText("Validate")).toBeInTheDocument();
  });

  it("renders processed/total counts", () => {
    render(<PipelineActivityPanel stages={stages} events={events} />);
    expect(screen.getByText("150,000/150,000")).toBeInTheDocument();
    expect(screen.getByText("138,000/150,000")).toBeInTheDocument();
  });

  it("renders throughput for active stages", () => {
    render(<PipelineActivityPanel stages={stages} events={events} />);
    expect(screen.getByText("32,000/s")).toBeInTheDocument();
    expect(screen.getByText("9,500/s")).toBeInTheDocument();
  });

  it("renders -- for zero throughput", () => {
    render(<PipelineActivityPanel stages={stages} events={events} />);
    // Validate stage has 0 throughput
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("renders activity feed events", () => {
    render(<PipelineActivityPanel stages={stages} events={events} />);
    expect(screen.getByText("SourceParsed")).toBeInTheDocument();
    expect(screen.getByText("ExceptionRaised")).toBeInTheDocument();
    expect(screen.getByText("Parsed 4 source files, 150,000 records")).toBeInTheDocument();
  });

  it("shows empty state when no events", () => {
    render(<PipelineActivityPanel stages={stages} events={[]} />);
    expect(screen.getByText("Waiting for events...")).toBeInTheDocument();
  });
});