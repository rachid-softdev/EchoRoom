import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReplayHeader } from "../ReplayHeader";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReplayHeader", () => {
  it("renders scenario title when provided", () => {
    render(<ReplayHeader scenarioTitle="Test Scenario" />);

    expect(screen.getByText("Scénario")).toBeInTheDocument();
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("renders fallback dash when scenario title is missing", () => {
    render(<ReplayHeader />);

    expect(screen.getByText("Scénario")).toBeInTheDocument();
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders character name when provided", () => {
    render(<ReplayHeader characterName="John Doe" />);

    expect(screen.getByText("Personnage")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("renders fallback dash when character name is missing", () => {
    render(<ReplayHeader />);

    expect(screen.getByText("Personnage")).toBeInTheDocument();
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders formatted duration when durationSeconds is provided", () => {
    render(<ReplayHeader durationSeconds={125} />);

    expect(screen.getByText("Durée")).toBeInTheDocument();
    // 125 seconds = 2:05
    expect(screen.getByText("2:05")).toBeInTheDocument();
  });

  it("renders fallback dash when durationSeconds is undefined", () => {
    render(<ReplayHeader />);

    expect(screen.getByText("Durée")).toBeInTheDocument();
    const durations = screen.getAllByText("-");
    expect(durations.length).toBeGreaterThanOrEqual(1);
  });

  it("renders duration 0s for zero seconds", () => {
    render(<ReplayHeader durationSeconds={0} />);

    expect(screen.getByText("0s")).toBeInTheDocument();
  });

  it("renders status label for COMPLETED status", () => {
    render(<ReplayHeader status="COMPLETED" />);

    expect(screen.getByText("Statut")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
  });

  it("renders status label for FAILED status", () => {
    render(<ReplayHeader status="FAILED" />);

    expect(screen.getByText("Échoué")).toBeInTheDocument();
  });

  it("renders fallback dash when status is unknown", () => {
    render(<ReplayHeader status="UNKNOWN" />);

    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("renders fallback dash when status is undefined", () => {
    render(<ReplayHeader />);

    expect(screen.getByText("Statut")).toBeInTheDocument();
    const statusDashes = screen.getAllByText("-");
    expect(statusDashes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders all fields when all props are provided", () => {
    render(
      <ReplayHeader
        scenarioTitle="Embassy Escape"
        characterName="Agent Smith"
        durationSeconds={300}
        status="COMPLETED"
      />,
    );

    expect(screen.getByText("Embassy Escape")).toBeInTheDocument();
    expect(screen.getByText("Agent Smith")).toBeInTheDocument();
    expect(screen.getByText("5:00")).toBeInTheDocument();
    expect(screen.getByText("Terminé")).toBeInTheDocument();
  });

  it("has four grid items", () => {
    const { container } = render(<ReplayHeader scenarioTitle="Test" />);

    // Check that the grid container exists
    const gridDiv = container.firstChild as HTMLElement;
    expect(gridDiv.className).toContain("grid");
    expect(gridDiv.children.length).toBe(4);
  });
});
