import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { FileDropView } from "@/components/demo/file-drop-view";

describe("FileDropView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().goTo("file-drop");
  });

  it("renders the file drop header", () => {
    render(<FileDropView />);
    expect(screen.getByText("File Drop")).toBeInTheDocument();
  });

  it("renders the drop zone text", () => {
    render(<FileDropView />);
    expect(
      screen.getByText("Drop Source Files Here"),
    ).toBeInTheDocument();
  });

  it("renders all 4 file names", () => {
    render(<FileDropView />);
    expect(
      screen.getByText("routepro_2019_export.csv"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("quickbooks_customer_export.tsv"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("transfer_station_weights.xlsx"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("legacy_paper_export.tab"),
    ).toBeInTheDocument();
  });

  it("shows fleet activated after files drop", () => {
    vi.useFakeTimers();
    render(<FileDropView />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("Fleet Activated")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows total records after files drop", () => {
    vi.useFakeTimers();
    render(<FileDropView />);
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText("Files Received")).toBeInTheDocument();
    vi.useRealTimers();
  });
});