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
    // The heading text includes the count in parens, so match on partial text
    expect(
      screen.getByText(/Aggregated by Type/),
    ).toBeInTheDocument();
  });

  it("renders evidence for featured exceptions", () => {
    render(<ExceptionReviewView />);
    expect(
      screen.getByText(/RoutePro rate: \$300\/mo/i),
    ).toBeInTheDocument();
  });

  it("renders suggested fixes", () => {
    render(<ExceptionReviewView />);
    expect(
      screen.getByText(/Use most recent rate from QuickBooks/i),
    ).toBeInTheDocument();
  });

  it("renders confidence scores", () => {
    render(<ExceptionReviewView />);
    expect(screen.getByText("0.97")).toBeInTheDocument();
  });

  it("renders featured count in header", () => {
    render(<ExceptionReviewView />);
    expect(screen.getByText(/0\/8/)).toBeInTheDocument();
  });

  it("approve button resolves an exception", () => {
    render(<ExceptionReviewView />);
    const approveButtons = screen.getAllByText("Approve");
    expect(approveButtons.length).toBe(8);
    fireEvent.click(approveButtons[0]);
    expect(screen.getAllByText(/approved/i).length).toBeGreaterThanOrEqual(1);
  });

  it("shows bulk resolve button after all featured are resolved", () => {
    render(<ExceptionReviewView />);
    const approveButtons = screen.getAllByText("Approve");
    approveButtons.forEach((btn) => fireEvent.click(btn));
    expect(screen.getByText("Bulk Resolve All")).toBeInTheDocument();
  });

  it("shows View Report button after all resolved", () => {
    render(<ExceptionReviewView />);
    // Resolve all featured
    const approveButtons = screen.getAllByText("Approve");
    approveButtons.forEach((btn) => fireEvent.click(btn));
    // Bulk resolve
    fireEvent.click(screen.getByText("Bulk Resolve All"));
    expect(screen.getByText("View Report")).toBeInTheDocument();
  });
});