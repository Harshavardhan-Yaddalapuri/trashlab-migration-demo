import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExceptionQueuePanel } from "@/components/cockpit/exception-queue-panel";
import type {
  ConfidenceSummary,
  ExceptionQueueItem,
} from "@/components/cockpit/types";

const exceptions: ExceptionQueueItem[] = [
  {
    id: "exc-1",
    type: "pricing_conflict",
    severity: "critical",
    summary: "Agreement A-04231: two rates for same container",
    confidence: 0.97,
    reviewStatus: "open",
    suggestedFix: "Use most recent rate ($450/mo).",
  },
  {
    id: "exc-2",
    type: "orphan_container",
    severity: "warning",
    summary: "Container RC-33109 has no owning site",
    confidence: 0.88,
    reviewStatus: "open",
    suggestedFix: "Assign to nearest yard.",
  },
];

const confidence: ConfidenceSummary = {
  high: 136_500,
  medium: 11_800,
  low: 1_700,
  buckets: [
    { lower: 0.0, count: 850 },
    { lower: 0.5, count: 0 },
    { lower: 0.9, count: 136_500 },
  ],
  mean: 0.94,
};

describe("ExceptionQueuePanel", () => {
  it("renders exception types", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getByText("pricing_conflict")).toBeInTheDocument();
    expect(screen.getByText("orphan_container")).toBeInTheDocument();
  });

  it("renders exception summaries", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getByText("Agreement A-04231: two rates for same container")).toBeInTheDocument();
  });

  it("renders suggested fixes", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getByText(/Use most recent rate/)).toBeInTheDocument();
  });

  it("renders confidence values", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getByText("0.97")).toBeInTheDocument();
    expect(screen.getByText("0.88")).toBeInTheDocument();
  });

  it("renders confidence distribution counts", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getByText("136,500")).toBeInTheDocument();
    expect(screen.getByText("11,800")).toBeInTheDocument();
    expect(screen.getByText("1,700")).toBeInTheDocument();
  });

  it("renders mean confidence", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    expect(screen.getAllByText("0.94").length).toBeGreaterThan(0);
  });

  it("renders percentage breakdowns", () => {
    render(<ExceptionQueuePanel exceptions={exceptions} confidence={confidence} />);
    const total = 136_500 + 11_800 + 1_700;
    const highPct = ((136_500 / total) * 100).toFixed(1);
    expect(screen.getByText(`${highPct}%`)).toBeInTheDocument();
  });

  it("shows empty state when no exceptions", () => {
    render(<ExceptionQueuePanel exceptions={[]} confidence={confidence} />);
    expect(screen.getByText("No exceptions")).toBeInTheDocument();
  });
});