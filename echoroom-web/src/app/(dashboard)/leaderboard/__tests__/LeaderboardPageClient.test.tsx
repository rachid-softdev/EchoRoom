import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock tRPC
const mockScenariosQuery = vi.hoisted(() => vi.fn());
const mockCreatorsQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      getLeaderboardScenarios: {
        useQuery: (...args: unknown[]) => (mockScenariosQuery as any)(...args),
      },
      getLeaderboardCreators: {
        useQuery: (...args: unknown[]) => (mockCreatorsQuery as any)(...args),
      },
    },
  },
}));

// Mock DashboardShell
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title, subtitle }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {subtitle && <p data-testid="shell-subtitle">{subtitle}</p>}
      {children}
    </div>
  ),
}));

// Mock LeaderboardTable
vi.mock("@/components/social/LeaderboardTable", () => ({
  LeaderboardTable: ({ title, entries, valueLabel, isLoading }: any) => (
    <div
      data-testid="leaderboard-table"
      data-title={title}
      data-value-label={valueLabel}
      data-is-loading={isLoading}
    >
      {isLoading ? (
        <div data-testid="loading-skeleton">Loading...</div>
      ) : (
        <ul>
          {entries.map((entry: any) => (
            <li key={entry.id} data-testid={`entry-${entry.id}`}>
              <span data-testid={`entry-name-${entry.id}`}>{entry.name}</span>
              <span data-testid={`entry-value-${entry.id}`}>{entry.value}</span>
              {entry.extra && <span data-testid={`entry-extra-${entry.id}`}>{entry.extra}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  ),
}));

// Mock @/components/ui (cn utility)
vi.mock("@echoroom/ui", () => ({
  cn: (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(" "),
}));

import LeaderboardPageClient from "../LeaderboardPageClient";

const mockScenarioData = {
  items: [
    {
      id: "s-1",
      title: "Top Scenario 1",
      character: { avatarUrl: "/s1.png" },
      creator: { username: "Alice" },
      likeCount: 100,
    },
    {
      id: "s-2",
      title: "Top Scenario 2",
      character: { avatarUrl: null },
      creator: { username: "Bob" },
      likeCount: 80,
    },
  ],
};
const mockCreatorData = {
  items: [
    {
      id: "u-1",
      username: "Alice",
      image: "/alice.png",
      totalLikesReceived: 500,
      _count: { scenarios: 3 },
    },
    { id: "u-2", username: "Bob", image: null, totalLikesReceived: 300, _count: { scenarios: 1 } },
  ],
};

describe("LeaderboardPageClient", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockScenariosQuery.mockReturnValue({
      data: mockScenarioData,
      isLoading: false,
      isError: false,
    });
    mockCreatorsQuery.mockReturnValue({
      data: mockCreatorData,
      isLoading: false,
      isError: false,
    });
  });

  it("renders the dashboard shell with title and subtitle", () => {
    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-title", "Classement");
    expect(
      screen.getByText("Les meilleurs scénarios et créateurs de la communauté"),
    ).toBeInTheDocument();
  });

  it("shows scenarios tab by default with leaderboard entries", () => {
    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Scénarios les plus likés",
    );
    expect(screen.getByTestId("entry-name-s-1")).toHaveTextContent("Top Scenario 1");
    expect(screen.getByTestId("entry-name-s-2")).toHaveTextContent("Top Scenario 2");
    expect(screen.getByTestId("entry-value-s-1")).toHaveTextContent("100");
    expect(screen.getByTestId("entry-extra-s-1")).toHaveTextContent("par Alice");
  });

  it("switches to creators tab when clicked", () => {
    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Créateurs les plus likés",
    );
    expect(screen.getByTestId("entry-name-u-1")).toHaveTextContent("Alice");
    expect(screen.getByTestId("entry-name-u-2")).toHaveTextContent("Bob");
    expect(screen.getByTestId("entry-value-u-1")).toHaveTextContent("500");
    expect(screen.getByTestId("entry-extra-u-1")).toHaveTextContent("3 scénarios");
  });

  it("shows singular 'scénario' when creator has 1 scenario", () => {
    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("entry-extra-u-2")).toHaveTextContent("1 scénario");
  });

  it("renders period filter buttons", () => {
    render(<LeaderboardPageClient />);

    expect(screen.getByText("Tout")).toBeInTheDocument();
    expect(screen.getByText("Cette semaine")).toBeInTheDocument();
    expect(screen.getByText("Ce mois")).toBeInTheDocument();
  });

  it("changes period when period button is clicked", () => {
    render(<LeaderboardPageClient />);

    // Default period is ALL, click on WEEK
    fireEvent.click(screen.getByText("Cette semaine"));

    // The component calls the query with the current period
    // After clicking "Cette semaine", the query should be called with period: "WEEK"
    const calls = mockScenariosQuery.mock.calls;
    const lastCallArgs = calls[calls.length - 1]![0];
    expect(lastCallArgs).toMatchObject({ period: "WEEK" });
  });

  it("shows loading state for scenarios when data is loading", () => {
    mockScenariosQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("shows loading state for creators when data is loading", () => {
    mockCreatorsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();
  });

  it("handles scenario with no creator username gracefully", () => {
    const dataWithoutCreator = {
      items: [
        { id: "s-3", title: "No Creator Scenario", character: { avatarUrl: null }, likeCount: 50 },
      ],
    };
    mockScenariosQuery.mockReturnValue({
      data: dataWithoutCreator,
      isLoading: false,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    expect(screen.getByTestId("entry-name-s-3")).toHaveTextContent("No Creator Scenario");
    expect(screen.queryByTestId("entry-extra-s-3")).not.toBeInTheDocument();
  });

  it("shows tabs with correct active styling", () => {
    render(<LeaderboardPageClient />);

    const scenariosTab = screen.getByText("Scénarios");
    const creatorsTab = screen.getByText("Créateurs");

    // Default: scenarios tab is active
    expect(scenariosTab.className).toContain("bg-card");
    expect(creatorsTab.className).toContain("text-muted-foreground");

    // Click creators
    fireEvent.click(creatorsTab);

    expect(creatorsTab.className).toContain("bg-card");
    expect(scenariosTab.className).toContain("text-muted-foreground");
  });

  // ── Empty states ─────────────────────────────────────────────

  it("shows empty state when scenarios data is empty", () => {
    mockScenariosQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    // LeaderboardTable mock renders data-title attribute
    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Scénarios les plus likés",
    );
    // With empty entries, the mock renders an empty <ul>
    expect(screen.getByTestId("leaderboard-table").querySelector("ul")?.children.length ?? 0).toBe(
      0,
    );
  });

  it("shows empty state when creators data is empty", () => {
    mockCreatorsQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Créateurs les plus likés",
    );
  });

  // ── Error states ─────────────────────────────────────────────

  it("does not crash when scenarios query errors", () => {
    mockScenariosQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Failed to load" },
    });

    render(<LeaderboardPageClient />);

    // Should not crash, should show empty entries (default [])
    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Scénarios les plus likés",
    );
  });

  it("does not crash when creators query errors", () => {
    mockCreatorsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Failed to load" },
    });

    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Créateurs les plus likés",
    );
  });

  // ── Undefined data edge cases ────────────────────────────────

  it("handles scenarios data with undefined items gracefully", () => {
    mockScenariosQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    // Should show empty entries (defaults to [])
    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Scénarios les plus likés",
    );
  });

  it("handles creators data with undefined items gracefully", () => {
    mockCreatorsQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<LeaderboardPageClient />);

    fireEvent.click(screen.getByText("Créateurs"));

    expect(screen.getByTestId("leaderboard-table")).toHaveAttribute(
      "data-title",
      "Créateurs les plus likés",
    );
  });

  // ── Period filter applies to both tabs ──────────────────────

  it("period filter is passed to creators query when switching tab with period set", () => {
    render(<LeaderboardPageClient />);

    // Change period to WEEK
    fireEvent.click(screen.getByText("Cette semaine"));

    // Switch to creators tab
    fireEvent.click(screen.getByText("Créateurs"));

    // The creators query should be called with the current period
    const creatorCalls = mockCreatorsQuery.mock.calls;
    const lastCreatorCall = creatorCalls[creatorCalls.length - 1];
    expect(lastCreatorCall![0]).toMatchObject({ period: "WEEK" });
  });

  it("period filter defaults to ALL", () => {
    render(<LeaderboardPageClient />);

    // First call to scenarios query should have period: "ALL"
    const firstCall = mockScenariosQuery.mock.calls[0]![0];
    expect(firstCall).toMatchObject({ period: "ALL" });
  });
});
