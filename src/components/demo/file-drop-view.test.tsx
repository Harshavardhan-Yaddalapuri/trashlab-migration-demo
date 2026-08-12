import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { FileDropView } from "@/components/demo/file-drop-view";

/** Build a fake File with real text content (FileReader reads it). */
function makeFile(name: string, content: string): File {
  return new File([content], name, { type: "text/plain" });
}

const ROUTEPRO_CSV = `name,phone,address,city,state,zip,sizeYards,type,dayOfWeek
"Summit Construction",313-555-0123,"100 Main St",Detroit,MI,48201,20,rolloff,Mon
"Apex Disposal",313-555-0111,"200 Oak Ave",Warren,MI,48091,4,frontload,Tue
"Blue Ridge Waste",313-555-0133,"300 Pine Rd",Lansing,MI,48901,30,rolloff,Wed`;

const QUICKBOOKS_TSV = `name,serviceCode,startDate,rateCents
"Summit Construction",SW-COMM-2YD,01/02/2023,12000
"Apex Disposal",SW-RO-20YD,2023-03-01,40000
Total,150000,,`;

const TRANSFER_TXT = `# Transfer Station Log - Springfield East
date:  containerId:  grossTons:
01/02/2023  RC-1023  4.5
03/04/2023  BIN 2044  3.2`;

const LEGACY_TAB = `NAME/SERVICE/ADDRESS/ROUTE/ZONE/CONTACT
Summit Construction        SW-COMM-2YD  100 Main St             RT-DET-001A13135550123
Apex Disposal            SW-RO-20YD   200 Oak Ave             RT-WAR-002B23135550111`;

describe("FileDropView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().syncFromPath("/migrate");
  });

  it("renders the connect header", () => {
    render(<FileDropView />);
    expect(screen.getByText("Connect a system")).toBeInTheDocument();
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

  it("counts REAL rows from an uploaded file", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("routepro_2019_export.csv", ROUTEPRO_CSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    // 3 data rows (header excluded)
    await waitFor(() => {
      expect(screen.getByText("routepro_2019_export.csv")).toBeInTheDocument();
    });
    expect(screen.getByText("3 rows")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("skips QuickBooks footer summary rows when counting", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("quickbooks_customer_export.tsv", QUICKBOOKS_TSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("quickbooks_customer_export.tsv")).toBeInTheDocument();
    });
    // 2 data rows, footer "Total" skipped
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("skips transfer-station comment lines when counting", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("transfer_station_weights.xlsx", TRANSFER_TXT);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("transfer_station_weights.xlsx")).toBeInTheDocument();
    });
    // 2 data rows, comment + header skipped
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("skips legacy column-key line when counting", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("legacy_paper_export.tab", LEGACY_TAB);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("legacy_paper_export.tab")).toBeInTheDocument();
    });
    // 2 data rows, key line skipped
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });

  it("shows Start Migration after a file is added", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("routepro_2019_export.csv", ROUTEPRO_CSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("Start Migration")).toBeInTheDocument();
    });
  });

  it("shows a connecting state after Start Migration is clicked", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("routepro_2019_export.csv", ROUTEPRO_CSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("Start Migration")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Start Migration"));
    expect(screen.getByText("Connecting...")).toBeInTheDocument();
  });

  it("shows a real error, not fake progress, when the API is unreachable", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("routepro_2019_export.csv", ROUTEPRO_CSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("Start Migration")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Start Migration"));
    // jsdom has no real network; the blob upload fails and the API call never happens.
    await waitFor(
      () => {
        expect(screen.getByText(/Couldn't start the migration/)).toBeInTheDocument();
      },
      { timeout: 10000 },
    );
    expect(screen.getByText("Start Migration")).toBeInTheDocument();
  });

  it("shows total records after a file is added", async () => {
    render(<FileDropView />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = makeFile("routepro_2019_export.csv", ROUTEPRO_CSV);
    Object.defineProperty(input, "files", {
      value: [file],
      configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText("Files Received")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
