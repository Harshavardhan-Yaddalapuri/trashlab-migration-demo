import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SourceSystemsPanel } from "@/components/cockpit/source-systems-panel";
import type { SourceSystemView } from "@/components/cockpit/types";

const sources: SourceSystemView[] = [
  {
    id: "src-1",
    kind: "routepro-csv",
    fileName: "routepro_export.csv",
    recordCount: 78_000,
    status: "parsed",
    parseErrors: 0,
  },
  {
    id: "src-2",
    kind: "quickbooks-export",
    fileName: "qb_export.tsv",
    recordCount: 45_000,
    status: "parsing",
    parseErrors: 3,
  },
];

describe("SourceSystemsPanel", () => {
  it("renders source file names", () => {
    render(<SourceSystemsPanel sources={sources} />);
    expect(screen.getByText("routepro_export.csv")).toBeInTheDocument();
    expect(screen.getByText("qb_export.tsv")).toBeInTheDocument();
  });

  it("shows formatted record counts", () => {
    render(<SourceSystemsPanel sources={sources} />);
    expect(screen.getByText("78,000")).toBeInTheDocument();
    expect(screen.getByText("45,000")).toBeInTheDocument();
  });

  it("shows total record count in footer", () => {
    render(<SourceSystemsPanel sources={sources} />);
    expect(screen.getByText("123,000")).toBeInTheDocument();
  });

  it("shows parse errors when present", () => {
    render(<SourceSystemsPanel sources={sources} />);
    expect(screen.getByText(/3 parse errors/)).toBeInTheDocument();
  });

  it("shows empty state when no sources", () => {
    render(<SourceSystemsPanel sources={[]} />);
    expect(screen.getByText("No sources loaded")).toBeInTheDocument();
  });
});