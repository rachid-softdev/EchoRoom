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
    scenarios: {
      feed: {
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

  it("renders the title 'Scénarios populaires'", () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByText("Scénarios")).toBeInTheDocument();
    expect(screen.getByText("populaires")).toBeInTheDocument();
  });

  it("renders the subtitle 'Découvrez ce que la communauté crée'", () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(
      screen.getByText("Découvrez ce que la communauté crée"),
    ).toBeInTheDocument();
  });

  it("renders 'Voir tout' link that points to /explore", () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
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

  it("renders scenario cards when data is available", () => {
    const mockData = {
      items: [
        { id: "1", title: "Scenario Alpha" },
        { id: "2", title: "Scenario Beta" },
        { id: "3", title: "Scenario Gamma" },
      ],
    };

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    const cards = screen.getAllByTestId("scenario-card");
    expect(cards).toHaveLength(3);
    expect(screen.getByText("Scenario Alpha")).toBeInTheDocument();
    expect(screen.getByText("Scenario Beta")).toBeInTheDocument();
    expect(screen.getByText("Scenario Gamma")).toBeInTheDocument();
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

  it("shows empty state when items array is empty", () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("passes limit:3 to the useQuery", () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<FeaturedScenariosSection />);

    expect(mockUseQuery).toHaveBeenCalledWith({ limit: 3 });
  });
});
