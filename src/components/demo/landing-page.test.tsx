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
    // The h2 contains "Right", "AND", "Fast." as separate text nodes
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toMatch(/Right/);
    expect(heading.textContent).toMatch(/AND/);
    expect(heading.textContent).toMatch(/Fast/);
  });

  it("renders the 90-second demo button", () => {
    render(<LandingPage />);
    expect(
      screen.getByText(/Start the 90-Second Demo/i),
    ).toBeInTheDocument();
  });

  it("renders the stats teaser with 99.2%", () => {
    render(<LandingPage />);
    expect(screen.getByText("99.2%")).toBeInTheDocument();
  });

  it("renders stats teaser with 2 Days", () => {
    render(<LandingPage />);
    expect(screen.getByText("2 Days")).toBeInTheDocument();
  });

  it("renders the 0 silent errors stat", () => {
    render(<LandingPage />);
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("renders fleet agent names", () => {
    render(<LandingPage />);
    expect(screen.getByText("Orchestrator")).toBeInTheDocument();
    expect(screen.getByText("Normalizer")).toBeInTheDocument();
    expect(screen.getByText("Validator")).toBeInTheDocument();
  });

  it("clicking start button advances to file-drop phase", () => {
    render(<LandingPage />);
    const button = screen.getByText(/Start the 90-Second Demo/i);
    fireEvent.click(button);
    expect(useDemoStore.getState().phase).toBe("file-drop");
    expect(useDemoStore.getState().isRunning).toBe(true);
  });

  it("renders the footer with dataset info", () => {
    render(<LandingPage />);
    // Footer contains Summit Disposal Services
    expect(
      screen.getByText(/Summit Disposal Services/i),
    ).toBeInTheDocument();
    // 150,000 records appears in the solution text AND footer
    expect(
      screen.getAllByText(/150,000 records/i).length,
    ).toBeGreaterThanOrEqual(1);
  });
});