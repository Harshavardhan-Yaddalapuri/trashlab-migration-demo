import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CockpitShell } from "@/components/cockpit/cockpit-shell";

describe("CockpitShell", () => {
  it("renders the header with app name", () => {
    render(<CockpitShell />);
    expect(
      screen.getByText("TrashLab Migration Cockpit"),
    ).toBeInTheDocument();
  });

  it("renders all three pane labels", () => {
    render(<CockpitShell />);
    expect(screen.getByText("Source Systems")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Exception Queue")).toBeInTheDocument();
  });

  it("renders mock source file names", () => {
    render(<CockpitShell />);
    expect(screen.getByText("routepro_2019_export.csv")).toBeInTheDocument();
  });

  it("renders mock pipeline events", () => {
    render(<CockpitShell />);
    expect(screen.getByText("SourceParsed")).toBeInTheDocument();
  });

  it("renders mock exceptions", () => {
    render(<CockpitShell />);
    expect(screen.getByText("pricing_conflict")).toBeInTheDocument();
  });

  it("renders total records in header", () => {
    render(<CockpitShell />);
    // 150,000 appears in both the header summary and the source systems footer
    expect(screen.getAllByText("150,000").length).toBeGreaterThanOrEqual(1);
  });

  it("renders open exception count in header", () => {
    render(<CockpitShell />);
    expect(screen.getByText("6")).toBeInTheDocument();
  });

  it("renders confidence distribution section", () => {
    render(<CockpitShell />);
    expect(screen.getByText("Confidence Distribution")).toBeInTheDocument();
    expect(screen.getByText("Mean Confidence")).toBeInTheDocument();
  });
});