import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks
const mockUsePaginatedQuery = vi.hoisted(() => vi.fn());
const mockLoadMore = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/usePaginatedQuery", () => ({
  usePaginatedQuery: (...args: unknown[]) => mockUsePaginatedQuery(...args),
}));

vi.mock("@/lib/trpc", () => ({
  api: {
    scenarios: {
      myScenarios: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Library: () => <svg data-testid="icon-library" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Search: () => <svg data-testid="icon-search" />,
  X: () => <svg data-testid="icon-x" />,
}));

// Mock @/components/ui
vi.mock("@echoroom/ui", () => ({
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, className, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      data-testid="search-input"
      {...props}
    />
  ),
}));

// Mock DashboardShell
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title, subtitle, actions }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {subtitle && <p data-testid="shell-subtitle">{subtitle}</p>}
      {actions && <div data-testid="shell-actions">{actions}</div>}
      {children}
    </div>
  ),
}));

// Mock ScenarioCard
vi.mock("@/components/shared/ScenarioCard", () => ({
  ScenarioCard: ({ scenario }: any) => (
    <div data-testid={`scenario-card-${scenario.id}`}>
      <span data-testid={`scenario-title-${scenario.id}`}>{scenario.title}</span>
      {scenario.character && (
        <span data-testid={`scenario-character-${scenario.id}`}>{scenario.character.name}</span>
      )}
      {scenario.creator && (
        <span data-testid={`scenario-creator-${scenario.id}`}>{scenario.creator.username}</span>
      )}
    </div>
  ),
}));

// Mock EmptyState
vi.mock("@/components/shared/EmptyState", () => ({
  EmptyState: ({ icon: _Icon, title, description, action }: any) => (
    <div data-testid="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  ),
}));

// Mock PaginatedDataLoader
vi.mock("@/components/shared/PaginatedDataLoader", () => ({
  PaginatedDataLoader: ({ query, children, empty, loadingSkeleton: _loadingSkeleton }: any) => {
    if (query.isLoading) {
      return <div data-testid="loader-loading">Chargement...</div>;
    }
    if (query.isError) {
      return <div data-testid="loader-error">Erreur</div>;
    }
    if (!query.items || query.items.length === 0) {
      return <div data-testid="loader-empty">{empty}</div>;
    }
    return <div data-testid="loader-data">{children(query.items)}</div>;
  },
}));

// Mock PaginatedGrid
vi.mock("@/components/shared/PaginatedGrid", () => ({
  PaginatedGrid: ({ children, hasMore, isLoadingMore, onLoadMore }: any) => (
    <div data-testid="paginated-grid" data-has-more={hasMore}>
      {children}
      {hasMore && (
        <button type="button" onClick={onLoadMore} disabled={isLoadingMore} data-testid="load-more-button">
          {isLoadingMore ? "Chargement..." : "Voir plus"}
        </button>
      )}
    </div>
  ),
}));

import LibraryPage from "../page";

const mockScenarios = [
  {
    id: "s-1",
    title: "Speed Dating",
    character: { name: "Roméo", category: "ROMANTIC" },
    creator: { username: "Alice" },
    playCount: 100,
    likeCount: 50,
  },
  {
    id: "s-2",
    title: "Chaos Fun",
    character: { name: "Clown", category: "CHAOTIC" },
    creator: { username: "Bob" },
    playCount: 200,
    likeCount: 80,
  },
  {
    id: "s-3",
    title: "Job Interview",
    character: { name: "BOSS", category: "CORPORATE" },
    creator: { username: "Charlie" },
    playCount: 50,
    likeCount: 30,
  },
];

function setupPaginatedMock(items: any[], hasMore: boolean, isLoading: boolean = false) {
  mockUsePaginatedQuery.mockReturnValue({
    items,
    isLoading,
    isError: false,
    error: null,
    hasMore,
    loadMore: mockLoadMore,
    isFetchingMore: false,
    refetch: vi.fn(),
  });
}

describe("LibraryPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setupPaginatedMock(mockScenarios, false);
  });

  it("renders the dashboard shell with title and subtitle", () => {
    render(<LibraryPage />);

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-title", "Bibliothèque");
    expect(screen.getByText("Vos scénarios sauvegardés et vos créations")).toBeInTheDocument();
  });

  it("renders new scenario button", () => {
    render(<LibraryPage />);

    expect(screen.getByText("Nouveau")).toBeInTheDocument();
  });

  it("renders scenario cards", () => {
    render(<LibraryPage />);

    expect(screen.getByTestId("scenario-card-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-2")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-3")).toBeInTheDocument();
    expect(screen.getByText("Speed Dating")).toBeInTheDocument();
    expect(screen.getByText("Chaos Fun")).toBeInTheDocument();
    expect(screen.getByText("Job Interview")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    setupPaginatedMock([], false, true);

    render(<LibraryPage />);

    expect(screen.getByTestId("loader-loading")).toBeInTheDocument();
  });

  it("shows empty state when no scenarios", () => {
    setupPaginatedMock([], false);

    render(<LibraryPage />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("Bibliothèque vide")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Créez votre premier scénario ou explorez la communauté pour trouver l'inspiration.",
      ),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<LibraryPage />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Rechercher par titre, personnage ou créateur..."),
    ).toBeInTheDocument();
  });

  it("filters scenarios by search query on title", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    expect(screen.getByTestId("scenario-card-s-1")).toBeInTheDocument();
    expect(screen.queryByTestId("scenario-card-s-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scenario-card-s-3")).not.toBeInTheDocument();
  });

  it("filters scenarios by character name", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Clown" } });

    expect(screen.queryByTestId("scenario-card-s-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-2")).toBeInTheDocument();
    expect(screen.queryByTestId("scenario-card-s-3")).not.toBeInTheDocument();
  });

  it("filters scenarios by creator username", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Charlie" } });

    expect(screen.queryByTestId("scenario-card-s-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("scenario-card-s-2")).not.toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-3")).toBeInTheDocument();
  });

  it("shows no results message when search has no matches", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistent" } });

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.getByText(/NonExistent/)).toBeInTheDocument();
  });

  it("shows clear search button when search has text", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    const clearButton = screen.getByLabelText("Effacer la recherche");
    expect(clearButton).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    const clearButton = screen.getByLabelText("Effacer la recherche");
    fireEvent.click(clearButton);

    expect(searchInput.value).toBe("");
    expect(screen.getByTestId("scenario-card-s-1")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-2")).toBeInTheDocument();
    expect(screen.getByTestId("scenario-card-s-3")).toBeInTheDocument();
  });

  it("shows load more button when hasMore is true", () => {
    setupPaginatedMock(mockScenarios, true);

    render(<LibraryPage />);

    const loadMoreButton = screen.getByTestId("load-more-button");
    expect(loadMoreButton).toBeInTheDocument();
  });

  it("calls loadMore when load more button is clicked", () => {
    setupPaginatedMock(mockScenarios, true);

    render(<LibraryPage />);

    const loadMoreButton = screen.getByTestId("load-more-button");
    fireEvent.click(loadMoreButton);

    expect(mockLoadMore).toHaveBeenCalled();
  });

  it("does not show load more button when hasMore is false", () => {
    setupPaginatedMock(mockScenarios, false);

    render(<LibraryPage />);

    expect(screen.queryByTestId("load-more-button")).not.toBeInTheDocument();
  });

  it("renders create and explore buttons in empty state", () => {
    setupPaginatedMock([], false);

    render(<LibraryPage />);

    expect(screen.getByText("Créer un scénario")).toBeInTheDocument();
    expect(screen.getByText("Explorer")).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────

  it("shows error state when paginated query has isError", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: { message: "Erreur de chargement" },
      hasMore: false,
      loadMore: mockLoadMore,
      isFetchingMore: false,
      refetch: vi.fn(),
    });

    render(<LibraryPage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
  });

  it("shows error with default message when error has no message", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: null,
      hasMore: false,
      loadMore: mockLoadMore,
      isFetchingMore: false,
      refetch: vi.fn(),
    });

    render(<LibraryPage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
  });

  // ── isFetchingMore state ─────────────────────────────────────

  it("shows loading text on load more button when isLoadingMore is true", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: mockScenarios,
      isLoading: false,
      isError: false,
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      isFetchingMore: true,
      refetch: vi.fn(),
    });

    render(<LibraryPage />);

    const loadMoreButton = screen.getByText("Chargement...").closest("button");
    expect(loadMoreButton).toBeInTheDocument();
    expect(loadMoreButton).toBeDisabled();
    expect(screen.queryByText("Voir plus")).not.toBeInTheDocument();
  });

  it("does not call loadMore when button is clicked while isLoadingMore", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: mockScenarios,
      isLoading: false,
      isError: false,
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      isFetchingMore: true,
      refetch: vi.fn(),
    });

    render(<LibraryPage />);

    const loadMoreButton = screen.getByText("Chargement...").closest("button");
    fireEvent.click(loadMoreButton!);
    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  // ── Search edge cases ────────────────────────────────────────

  it("handles search with special characters without crashing", () => {
    render(<LibraryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "<test>foo</test>" } });

    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });

  it("does not render scenario cards when in error state", () => {
    const refetch = vi.fn();
    mockUsePaginatedQuery.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: { message: "Error" },
      hasMore: false,
      loadMore: mockLoadMore,
      isFetchingMore: false,
      refetch,
    });

    render(<LibraryPage />);

    // Error state shown instead of cards
    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
    expect(screen.queryByTestId("scenario-card-s-1")).not.toBeInTheDocument();
  });
});
