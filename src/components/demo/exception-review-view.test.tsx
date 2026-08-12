import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { ExceptionReviewView } from "@/components/demo/exception-review-view";

describe("ExceptionReviewView", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
    useDemoStore.getState().goTo("exception-review");
  });

  it("renders exception review header", () => {
    render(<ExceptionReviewView />);
    expect(screen.getByText("Exception Review")).toBeInTheDocument();
  });

  it("renders 8 featured exceptions", () => {
    render(<ExceptionReviewView />);
    expect(screen.getAllByText("pricing_conflict").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("orphan_container").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("date_ambiguity").length).toBeGreaterThanOrEqual(2);
  });

  it("renders aggregated exceptions section", () => {
    render(<ExceptionReviewView />);
    expect(
      screen.getByText(/Aggregated by Type/),
    ).toBeInTheDocument();
  });

  it("shows evidence after clicking Show evidence", () => {
    render(<ExceptionReviewView />);
    // Evidence is hidden by default; click the first toggle
    const toggle = screen.getAllByText("Show evidence")[0];
    fireEvent.click(toggle);
    expect(
      screen.getByText(/RoutePro rate: \$300\/mo/i),
    ).toBeInTheDocument();
  });

  it("shows suggested fixes after expanding evidence", () => {
    render(<ExceptionReviewView />);
    const toggle = screen.getAllByText("Show evidence")[0];
    fireEvent.click(toggle);
    expect(
      screen.getByText(/Use most recent rate from QuickBooks/i),
    ).toBeInTheDocument();
  });

  it("renders confidence scores", () => {
    render(<ExceptionReviewView />);
    expect(screen.getByText("confidence 0.97")).toBeInTheDocument();
  });

  it("renders featured count in header", () => {
    render(<ExceptionReviewView />);
    expect(screen.getByText(/0\/8/)).toBeInTheDocument();
  });

  it("approve requires confirmation then resolves an exception", () => {
    render(<ExceptionReviewView />);
    const approveButtons = screen.getAllByText("Approve");
    expect(approveButtons.length).toBe(8);
    fireEvent.click(approveButtons[0]);
    // Confirm step appears
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Confirm"));
    expect(screen.getAllByText(/approved/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows bulk resolve button after all featured are resolved", () => {
    render(<ExceptionReviewView />);
    const approveButtons = screen.getAllByText("Approve");
    approveButtons.forEach((btn) => {
      fireEvent.click(btn);
      fireEvent.click(screen.getByText("Confirm"));
    });
    expect(screen.getByText("Bulk Resolve All")).toBeInTheDocument();
  });

  it("shows View Report button after all resolved", () => {
    render(<ExceptionReviewView />);
    const approveButtons = screen.getAllByText("Approve");
    approveButtons.forEach((btn) => {
      fireEvent.click(btn);
      fireEvent.click(screen.getByText("Confirm"));
    });
    fireEvent.click(screen.getByText("Bulk Resolve All"));
    expect(screen.getByText("View Report")).toBeInTheDocument();
  });

  it("drills into aggregated records on row click", () => {
    render(<ExceptionReviewView />);
    // "duplicate_customer" appears in featured badge AND aggregated row; click the row (last match)
    const matches = screen.getAllByText("duplicate_customer");
    fireEvent.click(matches[matches.length - 1]);
    expect(screen.getByText(/412 records/)).toBeInTheDocument();
    expect(screen.getAllByText(/Summit Construction LLC/).length).toBeGreaterThanOrEqual(1);
  });
});
