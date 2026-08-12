import React from "react";
import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useDemoStore } from "@/components/demo/demo-store";
import { LandingPage } from "@/components/demo/landing-page";

describe("LandingPage", () => {
  beforeEach(() => {
    useDemoStore.getState().reset();
  });

  it("renders the TrashLab FAQ quote", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Implementation depends on the size of your operation/i),
    ).toBeInTheDocument();
  });

  it("renders the solution framing with Right AND Fast", () => {
    render(<LandingPage />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/Right/);
    expect(heading.textContent).toMatch(/AND/);
    expect(heading.textContent).toMatch(/Fast/);
  });

  it("renders the See It In Action button", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/See It In Action/i),
    ).toBeInTheDocument();
  });

  it("renders the 2 Days outcome stat", () => {
    render(<LandingPage />);
    expect(screen.getByText("2 Days")).toBeInTheDocument();
  });

  it("renders the 150k Records Moved Clean stat", () => {
    render(<LandingPage />);
    expect(screen.getByText("150k")).toBeInTheDocument();
    expect(screen.getByText("Records Moved Clean")).toBeInTheDocument();
  });

  it("renders the 0 Lost or Duplicated stat", () => {
    render(<LandingPage />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Lost or Duplicated")).toBeInTheDocument();
  });

  it("does NOT show internal agent names to customers", () => {
    render(<LandingPage />);
    expect(screen.queryByText("Orchestrator")).not.toBeInTheDocument();
    expect(screen.queryByText("Normalizer")).not.toBeInTheDocument();
    expect(screen.queryByText("Validator")).not.toBeInTheDocument();
    expect(screen.queryByText("Eval")).not.toBeInTheDocument();
  });

  it("clicking start button marks the demo as running", () => {
    render(<LandingPage />);
    const button = screen.getByText(/See It In Action/i);
    fireEvent.click(button);
    expect(useDemoStore.getState().isRunning).toBe(true);
  });

  it("renders the footer with dataset info", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Summit Disposal Services/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/150,000 records/i).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
