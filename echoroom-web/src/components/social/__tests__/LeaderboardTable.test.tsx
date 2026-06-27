import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LeaderboardTable } from "../LeaderboardTable";

const mockEntries = [
  { rank: 1, name: "Alice", value: 2500, image: "/alice.png", extra: "Pro", id: "u-1" },
  { rank: 2, name: "Bob", value: 1800, image: null, id: "u-2" },
  { rank: 3, name: "Charlie", value: 1200, image: null, id: "u-3" },
  { rank: 4, name: "Dave", value: 800, image: null, id: "u-4" },
];

describe("LeaderboardTable", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows loading skeleton with 5 items", () => {
    const { container } = render(
      <LeaderboardTable title="Classement" entries={[]} valueLabel="pts" isLoading={true} />,
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(5);
  });

  it("shows empty state when no entries", () => {
    render(<LeaderboardTable title="Classement" entries={[]} valueLabel="pts" isLoading={false} />);

    expect(screen.getByText(/Aucune entrée/i)).toBeInTheDocument();
  });

  it("renders all entries", () => {
    render(
      <LeaderboardTable
        title="Classement"
        entries={mockEntries}
        valueLabel="pts"
        isLoading={false}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
    expect(screen.getByText("Dave")).toBeInTheDocument();
  });

  it("renders extra field when provided", () => {
    render(
      <LeaderboardTable
        title="Classement"
        entries={mockEntries}
        valueLabel="pts"
        isLoading={false}
      />,
    );

    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows numeric rank for rank 4+", () => {
    render(
      <LeaderboardTable
        title="Classement"
        entries={mockEntries}
        valueLabel="pts"
        isLoading={false}
      />,
    );

    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
