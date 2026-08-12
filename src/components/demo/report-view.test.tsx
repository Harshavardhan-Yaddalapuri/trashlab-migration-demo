import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { ReportView } from "@/components/demo/report-view";

describe("ReportView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().goTo("report");
  });

  it("renders migration complete header", () => {
    render(<ReportView />);
    expect(
      screen.getByText("Migration Complete"),
    ).toBeInTheDocument();
  });

  it("renders go-live days metric", () => {
    render(<ReportView />);
    expect(screen.getByText("Go-Live")).toBeInTheDocument();
    expect(screen.getByText("days")).toBeInTheDocument();
  });

  it("renders 99.2% auto-mapped", () => {
    render(<ReportView />);
    // 99.2% appears in headline metric + source breakdown rates
    expect(screen.getAllByText("99.2%").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Auto-Mapped")).toBeInTheDocument();
  });

  it("renders 0 silent errors", () => {
    render(<ReportView />);
    expect(screen.getByText("Silent Errors")).toBeInTheDocument();
  });

  it("renders confidence distribution section", () => {
    render(<ReportView />);
    expect(
      screen.getByText("Confidence Distribution"),
    ).toBeInTheDocument();
  });

  it("renders source system breakdown", () => {
    render(<ReportView />);
    expect(
      screen.getByText("By Source System"),
    ).toBeInTheDocument();
    expect(screen.getByText("RoutePro CSV")).toBeInTheDocument();
    expect(screen.getByText("QuickBooks")).toBeInTheDocument();
  });

  it("renders entity type breakdown", () => {
    render(<ReportView />);
    expect(
      screen.getByText("By Entity Type"),
    ).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Containers")).toBeInTheDocument();
    expect(screen.getByText("Scale Tickets")).toBeInTheDocument();
  });

  it("renders training packets section", () => {
    render(<ReportView />);
    expect(
      screen.getByText("Training Packets Ready"),
    ).toBeInTheDocument();
    expect(screen.getByText("Business Owner")).toBeInTheDocument();
    expect(screen.getByText("Dispatcher")).toBeInTheDocument();
    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Customer Service")).toBeInTheDocument();
  });

  it("renders audit trail section", () => {
    render(<ReportView />);
    expect(
      screen.getByText("Audit Trail Complete"),
    ).toBeInTheDocument();
    expect(screen.getByText("JobCreated")).toBeInTheDocument();
    expect(screen.getByText("JobCompleted")).toBeInTheDocument();
  });

  it("renders the closing statement", () => {
    render(<ReportView />);
    expect(
      screen.getByText(/I ran 15 agents to build this overnight/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Imagine what I would do with yours/i),
    ).toBeInTheDocument();
  });

  it("renders run again button", () => {
    render(<ReportView />);
    expect(screen.getByText("Run Again")).toBeInTheDocument();
  });

  it("shows high/medium/low confidence counts", () => {
    render(<ReportView />);
    expect(screen.getByText(/High \(0\.9\+\)/)).toBeInTheDocument();
    expect(screen.getByText(/Medium \(0\.7-0\.9\)/)).toBeInTheDocument();
    expect(screen.getByText(/Low \(0\.0-0\.7\)/)).toBeInTheDocument();
  });
});