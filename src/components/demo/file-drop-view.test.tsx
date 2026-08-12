import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("starts empty with no files listed", () => {
    render(<FileDropView />);
    expect(
      screen.queryByText("routepro_2019_export.csv"),
    ).not.toBeInTheDocument();
  });

  it("adds a file when the drop zone is clicked and a file is selected", () => {
    render(<FileDropView />);
    // Simulate file selection via the hidden input
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    // Create a fake FileList
    const file = new File(["dummy"], "routepro_2019_export.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    expect(screen.getByText("routepro_2019_export.csv")).toBeInTheDocument();
  });

  it("shows Start Migration after a file is added", () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "quickbooks_customer_export.tsv", { type: "text/tab-separated-values" });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    expect(screen.getByText("Start Migration")).toBeInTheDocument();
  });

  it("shows fleet activated after Start Migration is clicked", () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "routepro_2019_export.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    fireEvent.click(screen.getByText("Start Migration"));
    expect(screen.getByText("Fleet Activated")).toBeInTheDocument();
  });

  it("shows total records after a file is added", () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["dummy"], "routepro_2019_export.csv", { type: "text/csv" });
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    expect(screen.getByText("Files Received")).toBeInTheDocument();
  });
});
