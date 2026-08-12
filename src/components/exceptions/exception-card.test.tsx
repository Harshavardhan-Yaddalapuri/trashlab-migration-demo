import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExceptionCard } from "@/components/exceptions/exception-card";
import type { ExceptionIssue } from "@/lib/types";

const exception: ExceptionIssue = {
  id: "exc-1",
  jobId: "job-1",
  type: "pricing_conflict",
  severity: "critical",
  summary: "Conflicting mapping for ag-1",
  evidence: ["e-1", "e-2"],
  suggestedFix: "Review both sources",
  reviewStatus: "open",
  createdAt: "2026-08-12T00:00:00.000Z",
};

describe("ExceptionCard", () => {
  it("renders the exception summary and evidence", () => {
    render(<ExceptionCard exception={exception} />);
    expect(screen.getByText("Conflicting mapping for ag-1")).toBeInTheDocument();
    expect(screen.getByText("e-1")).toBeInTheDocument();
    expect(screen.getByText("e-2")).toBeInTheDocument();
  });
});
