import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-auth (MarketingNav uses useSession)
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => "/explore"),
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    scenarios: {
      feed: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock MarketingNav
vi.mock("@/components/layout/MarketingNav", () => ({
  MarketingNav: () => <nav data-testid="marketing-nav" />,
}));

// Mock DataLoader — simple stub that renders children when data is available
vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({ query, children, skeleton }: any) => {
    if (query.isLoading) {
      return skeleton ?? <div data-testid="loader-loading">Chargement...</div>;
    }
    if (query.isError) {
      return <div data-testid="loader-error">Erreur</div>;
    }
    if (!query.data) {
      return <div data-testid="loader-empty">Aucun résultat</div>;
    }
    return <>{children(query.data)}</>;
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Search: () => <svg data-testid="icon-search" />,
  Shuffle: () => <svg data-testid="icon-shuffle" />,
  ChevronDown: () => <svg data-testid="icon-chevron-down" />,
  ChevronUp: () => <svg data-testid="icon-chevron-up" />,
}));

// Mock @/components/ui (SegmentedControl, Input, Button)
vi.mock("@/components/ui", () => ({
  Input: (props: any) => <input {...props} />,
  Button: ({ children, onClick, variant, className, size, ...props }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
  SegmentedControl: ({ options, value, onChange }: any) => (
    <div data-testid="segmented-control">
      {options.map((opt: any) => (
        <button type="button"
          key={opt.value}
          data-selected={value === opt.value}
          onClick={() => onChange?.(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  ),
}));

import { api } from "@/lib/trpc";
import ExplorePage from "../page";

const mockFeedQuery = api.scenarios.feed.useQuery as ReturnType<typeof vi.fn>;

const mockScenarios = {
  items: [
    {
      id: "s-1",
      title: "AI Adventure",
      description: "An adventure",
      character: { category: "NPC" },
      category: "NPC",
      playCount: 100,
      likeCount: 50,
    },
    {
      id: "s-2",
      title: "Chaos Fun",
      description: "Chaos fun",
      character: { category: "CHAOTIC" },
      category: "CHAOTIC",
      playCount: 200,
      likeCount: 80,
    },
    {
      id: "s-3",
      title: "Romantic Date",
      description: "Romantic date",
      character: { category: "ROMANTIC" },
      category: "ROMANTIC",
      playCount: 50,
      likeCount: 30,
    },
  ],
  nextCursor: undefined,
};

// Mock ScenarioCard
vi.mock("@/components/shared/ScenarioCard", () => ({
  ScenarioCard: ({ scenario }: any) => <div data-testid="scenario-card">{scenario.title}</div>,
}));

describe("ExplorePage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedQuery.mockReturnValue({
      isLoading: false,
      data: mockScenarios,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("renders scenarios when data loaded", () => {
    render(<ExplorePage />);

    expect(screen.getByText("AI Adventure")).toBeInTheDocument();
    expect(screen.getByText("Chaos Fun")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockFeedQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ExplorePage />);

    // DataLoader mock renders "Chargement..." when loading
    expect(screen.getByText(/chargement/i)).toBeInTheDocument();
  });

  it("shows category filter buttons", () => {
    render(<ExplorePage />);

    // Use getAllByText since "Tous" could appear in multiple contexts
    const tousButtons = screen.getAllByText("Tous");
    expect(tousButtons.length).toBeGreaterThanOrEqual(1);
    expect(tousButtons[0]).toBeInTheDocument();
    expect(screen.getByText("Chaotique")).toBeInTheDocument();
    expect(screen.getByText("Romantique")).toBeInTheDocument();
    expect(screen.getByText("NPC")).toBeInTheDocument();
  });

  it("shows error state when feed query fails", () => {
    mockFeedQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur de chargement" },
      refetch: vi.fn(),
    });

    render(<ExplorePage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
  });

  it("shows empty state when no scenarios returned", () => {
    mockFeedQuery.mockReturnValue({
      isLoading: false,
      data: { items: [], nextCursor: undefined },
      isError: false,
      refetch: vi.fn(),
    });

    render(<ExplorePage />);

    // When items array is empty and no search query, the render function shows a custom empty state
    expect(screen.getByText(/Rien ici pour/)).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<ExplorePage />);

    const searchInput = screen.getByPlaceholderText("Rechercher un scénario...");
    expect(searchInput).toBeInTheDocument();
  });

  it("renders sort toggle with segmented control", () => {
    render(<ExplorePage />);

    expect(screen.getByTestId("segmented-control")).toBeInTheDocument();
  });

  it("renders the page heading", () => {
    render(<ExplorePage />);

    expect(screen.getByRole("heading", { name: /Explorer les scénarios/i })).toBeInTheDocument();
  });

  it("renders scenario cards with correct count", () => {
    render(<ExplorePage />);

    const cards = screen.getAllByTestId("scenario-card");
    expect(cards).toHaveLength(3);
  });
});
