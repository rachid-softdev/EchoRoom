import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// FeaturedScenariosSection tests — renders "Scénarios populaires" title
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock tRPC API query to return controlled data
const mockUseQuery = vi.fn();

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      getFeatured: {
        useQuery: (...args: any[]) => mockUseQuery(...args),
      },
    },
  },
}));

// Mock DataLoader to render its children with the query data directly.
// This avoids complex DataLoader state management and focuses testing
// on how FeaturedScenariosSection wires DataLoader with the query.
vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({ children, query, isEmpty }: any) => {
    if (query.isLoading) {
      return <div data-testid="loading">Chargement...</div>;
    }
    if (query.isError) {
      return <div data-testid="error">Erreur</div>;
    }
    if (!query.data || (isEmpty && isEmpty(query.data))) {
      return <div data-testid="empty">Aucun résultat</div>;
    }
    return <div data-testid="data-loaded">{children(query.data)}</div>;
  },
}));

// Mock ScenarioCard to render a simplified card for testing
vi.mock("@/components/shared/ScenarioCard", () => ({
  ScenarioCard: ({ scenario }: any) => (
    <div data-testid="scenario-card">{scenario.title}</div>
  ),
}));

vi.mock("@/components/ui", () => ({
  Badge: ({ children, ...props }: any) => (
    <span {...props}>{children}</span>
  ),
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowRight: () => <svg data-testid="arrow-right-icon" />,
}));

afterEach(() => {
  cleanup();
});

describe("FeaturedScenariosSection", () => {
  let FeaturedScenariosSection: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../FeaturedScenariosSection");
    FeaturedScenariosSection = mod.FeaturedScenariosSection;
  });

  it("renders the title 'Scénario à la une'", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByText("Scénario")).toBeInTheDocument();
    expect(screen.getByText("à la une")).toBeInTheDocument();
  });

  it("renders the subtitle 'Découvrez le scénario du jour'", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(
      screen.getByText("Découvrez le scénario du jour sélectionné par la communauté"),
    ).toBeInTheDocument();
  });

  it("renders 'Voir tout' link that points to /explore", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    const voirTout = screen.getByText("Voir tout");
    expect(voirTout).toBeInTheDocument();
    const link = voirTout.closest("a");
    expect(link).toHaveAttribute("href", "/explore");
  });

  it("renders scenario card when data is available", () => {
    const mockScenario = { id: "1", title: "Scenario Alpha" };

    mockUseQuery.mockReturnValue({
      data: mockScenario,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    const cards = screen.getAllByTestId("scenario-card");
    expect(cards).toHaveLength(1);
    expect(screen.getByText("Scenario Alpha")).toBeInTheDocument();
    expect(screen.getByText("À la une")).toBeInTheDocument();
  });

  it("shows loading skeleton while data is loading", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  it("shows error state when query fails", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Network error" },
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByTestId("error")).toBeInTheDocument();
  });

  it("shows empty state when no featured scenario is set", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("calls useQuery with no arguments", () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(mockUseQuery).toHaveBeenCalledWith();
  });
});
