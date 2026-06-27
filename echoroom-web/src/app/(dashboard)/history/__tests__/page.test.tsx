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
    calls: {
      history: {
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
  Clock: () => <svg data-testid="icon-clock" />,
  Phone: () => <svg data-testid="icon-phone" />,
  Search: () => <svg data-testid="icon-search" />,
  X: () => <svg data-testid="icon-x" />,
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, disabled, variant, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
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
  DashboardShell: ({ children, title, subtitle }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {subtitle && <p data-testid="shell-subtitle">{subtitle}</p>}
      {children}
    </div>
  ),
}));

// Mock CallHistoryRow
vi.mock("@/components/shared/CallHistoryRow", () => ({
  CallHistoryRow: ({ call }: any) => (
    <div data-testid={`call-row-${call.id}`}>
      <span data-testid={`call-title-${call.id}`}>{call.scenario?.title ?? "Appel"}</span>
      <span data-testid={`call-status-${call.id}`}>{call.status}</span>
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

import HistoryPage from "../page";

const mockCalls = [
  {
    id: "call-1",
    status: "COMPLETED",
    durationSeconds: 120,
    createdAt: new Date("2026-06-01"),
    scenario: { title: "Speed Dating", character: { name: "Roméo" } },
  },
  {
    id: "call-2",
    status: "FAILED",
    durationSeconds: 30,
    createdAt: new Date("2026-06-02"),
    scenario: { title: "Job Interview", character: { name: "BOSS" } },
  },
  {
    id: "call-3",
    status: "ACTIVE",
    durationSeconds: 300,
    createdAt: new Date("2026-06-03"),
    scenario: { title: "Chaos Call", character: { name: "Clown" } },
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

describe("HistoryPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    setupPaginatedMock(mockCalls, false);
  });

  it("renders the dashboard shell with title and subtitle", () => {
    render(<HistoryPage />);

    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-title",
      "Historique des appels",
    );
    expect(
      screen.getByText("Consultez vos appels passés et réécoutez vos meilleurs moments"),
    ).toBeInTheDocument();
  });

  it("renders call history rows", () => {
    render(<HistoryPage />);

    expect(screen.getByTestId("call-row-call-1")).toBeInTheDocument();
    expect(screen.getByTestId("call-row-call-2")).toBeInTheDocument();
    expect(screen.getByTestId("call-row-call-3")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    setupPaginatedMock([], false, true);

    render(<HistoryPage />);

    expect(screen.getByTestId("loader-loading")).toBeInTheDocument();
  });

  it("shows empty state when no calls", () => {
    setupPaginatedMock([], false);

    render(<HistoryPage />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("Aucun appel pour le moment")).toBeInTheDocument();
    expect(
      screen.getByText("Lancez votre premier appel pour voir votre historique ici."),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    render(<HistoryPage />);

    expect(screen.getByTestId("search-input")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Rechercher par scénario, personnage ou statut..."),
    ).toBeInTheDocument();
  });

  it("filters calls by search query", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    // Should only show calls matching "Speed"
    expect(screen.getByTestId("call-row-call-1")).toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-3")).not.toBeInTheDocument();
  });

  it("filters calls by character name", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Roméo" } });

    expect(screen.getByTestId("call-row-call-1")).toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-3")).not.toBeInTheDocument();
  });

  it("filters calls by status", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "FAILED" } });

    expect(screen.queryByTestId("call-row-call-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("call-row-call-2")).toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-3")).not.toBeInTheDocument();
  });

  it("shows no results message when search has no matches", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "NonExistentCall" } });

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.getByText(/NonExistentCall/)).toBeInTheDocument();
  });

  it("shows clear search button when search has text", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    // Clear button should be visible
    const clearButton = screen.getByLabelText("Effacer la recherche");
    expect(clearButton).toBeInTheDocument();
  });

  it("clears search when clear button is clicked", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input") as HTMLInputElement;
    fireEvent.change(searchInput, { target: { value: "Speed" } });

    const clearButton = screen.getByLabelText("Effacer la recherche");
    fireEvent.click(clearButton);

    // After clearing, all calls should be visible
    expect(searchInput.value).toBe("");
    expect(screen.getByTestId("call-row-call-1")).toBeInTheDocument();
    expect(screen.getByTestId("call-row-call-2")).toBeInTheDocument();
    expect(screen.getByTestId("call-row-call-3")).toBeInTheDocument();
  });

  it("shows Voir plus button when hasMore is true", () => {
    setupPaginatedMock(mockCalls, true);

    render(<HistoryPage />);

    expect(screen.getByText("Voir plus")).toBeInTheDocument();
  });

  it("does not show Voir plus button when hasMore is false", () => {
    setupPaginatedMock(mockCalls, false);

    render(<HistoryPage />);

    expect(screen.queryByText("Voir plus")).not.toBeInTheDocument();
  });

  it("calls loadMore when Voir plus is clicked", () => {
    setupPaginatedMock(mockCalls, true);

    render(<HistoryPage />);

    const voirPlusButton = screen.getByText("Voir plus");
    fireEvent.click(voirPlusButton);

    expect(mockLoadMore).toHaveBeenCalled();
  });

  it("shows empty state with create call button", () => {
    setupPaginatedMock([], false);

    render(<HistoryPage />);

    expect(screen.getByText("Créer un appel")).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────

  it("shows error state when paginated query has isError", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: { message: "Impossible de charger l'historique" },
      hasMore: false,
      loadMore: mockLoadMore,
      isFetchingMore: false,
      refetch: vi.fn(),
    });

    render(<HistoryPage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
  });

  it("shows error state with default message when error has no message", () => {
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

    render(<HistoryPage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
  });

  // ── isFetchingMore state ─────────────────────────────────────

  it("shows loading text on Voir plus button when isFetchingMore is true", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: mockCalls,
      isLoading: false,
      isError: false,
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      isFetchingMore: true,
      refetch: vi.fn(),
    });

    render(<HistoryPage />);

    const loadMoreButton = screen.getByText("Chargement...").closest("button");
    expect(loadMoreButton).toBeInTheDocument();
    expect(loadMoreButton).toBeDisabled();
    expect(screen.queryByText("Voir plus")).not.toBeInTheDocument();
  });

  it("does not call loadMore when button is clicked while isFetchingMore", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: mockCalls,
      isLoading: false,
      isError: false,
      error: null,
      hasMore: true,
      loadMore: mockLoadMore,
      isFetchingMore: true,
      refetch: vi.fn(),
    });

    render(<HistoryPage />);

    const loadMoreButton = screen.getByText("Chargement...").closest("button");
    fireEvent.click(loadMoreButton!);
    expect(mockLoadMore).not.toHaveBeenCalled();
  });

  // ── Search with special characters ───────────────────────────

  it("handles search with special characters without crashing", () => {
    render(<HistoryPage />);

    const searchInput = screen.getByTestId("search-input");
    fireEvent.change(searchInput, { target: { value: "<script>alert('xss')</script>" } });

    // Should still render the shell without error
    expect(screen.getByTestId("dashboard-shell")).toBeInTheDocument();
    // No matches results
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });

  it("shows error state and does not render call rows", () => {
    mockUsePaginatedQuery.mockReturnValue({
      items: [],
      isLoading: false,
      isError: true,
      error: { message: "Error" },
      hasMore: false,
      loadMore: mockLoadMore,
      isFetchingMore: false,
      refetch: vi.fn(),
    });

    render(<HistoryPage />);

    // Error state rendered instead of call rows
    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
    expect(screen.queryByTestId("call-row-call-1")).not.toBeInTheDocument();
  });
});
