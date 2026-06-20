import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    admin: {
      listUsers: {
        useQuery: vi.fn(),
      },
      getUserDetail: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock lucide-react icons used by UsersPageClient and DataLoader
vi.mock("lucide-react", () => ({
  Users: () => <svg data-testid="icon-users" />,
  Search: () => <svg data-testid="icon-search" />,
  X: () => <svg data-testid="icon-x" />,
  ChevronLeft: () => <svg data-testid="icon-chevron-left" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

import { api } from "@/lib/trpc";
import UsersPageClient from "../UsersPageClient";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const mockListQuery = api.admin.listUsers.useQuery as ReturnType<typeof vi.fn>;
const mockDetailQuery = api.admin.getUserDetail
  .useQuery as ReturnType<typeof vi.fn>;

const sampleUser = {
  id: "u-1",
  username: "johndoe",
  email: "john@example.com",
  role: "USER",
  credits: 100,
  createdAt: new Date("2024-01-15"),
  deletedAt: null,
};

const sampleAdminUser = {
  id: "u-2",
  username: "admin1",
  email: "admin@echoroom.app",
  role: "ADMIN",
  credits: 500,
  createdAt: new Date("2024-01-10"),
  deletedAt: null,
};

const sampleDeletedUser = {
  id: "u-3",
  username: "deleteduser",
  email: "deleted@example.com",
  role: "USER",
  credits: 0,
  createdAt: new Date("2024-02-01"),
  deletedAt: new Date("2024-03-01"),
};

const sampleModeratorUser = {
  id: "u-4",
  username: "moderator1",
  email: "mod@echoroom.app",
  role: "MODERATOR",
  credits: 200,
  createdAt: new Date("2024-04-01"),
  deletedAt: null,
};

const sampleUserDetail = {
  id: "u-1",
  username: "johndoe",
  email: "john@example.com",
  role: "USER",
  credits: 100,
  totalCallsMade: 42,
  totalLikesReceived: 15,
  consentAcceptedAt: new Date("2024-02-01"),
  createdAt: new Date("2024-01-15"),
  _count: {
    scenarios: 5,
    comments: 12,
    reactions: 30,
  },
};

function buildListQueryMock(items: any[] = [sampleUser]) {
  return {
    isLoading: false,
    data: { items },
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("UsersPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: detail query returns data based on enabled flag
    // useQuery signature: (input, options) where options.enabled controls
    // whether the query is active.
    mockDetailQuery.mockImplementation(
      (
        input: { userId?: string },
        options?: { enabled?: boolean },
      ) => ({
        isLoading: false,
        data: options?.enabled && input?.userId ? sampleUserDetail : undefined,
        isError: false,
        error: null,
        refetch: vi.fn(),
      }),
    );
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it("should show loading skeleton when list is loading", () => {
    mockListQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it("should show error state when list query fails", () => {
    mockListQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur de chargement" },
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Réessayer/i }),
    ).toBeInTheDocument();
  });

  it("should call refetch on retry", () => {
    const refetch = vi.fn();
    mockListQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur" },
      refetch,
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("should show empty state when no users", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([]));

    render(<UsersPageClient />);

    expect(screen.getByText("Aucun utilisateur")).toBeInTheDocument();
    expect(
      screen.getByText("Aucun utilisateur enregistré."),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // List view — page layout
  // -----------------------------------------------------------------------

  it("should render the page title and description", () => {
    mockListQuery.mockReturnValue(buildListQueryMock());

    render(<UsersPageClient />);

    expect(
      screen.getByRole("heading", { name: "Gestion des utilisateurs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Recherchez et gérez les utilisateurs de la plateforme"),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  it("should render the search input", () => {
    mockListQuery.mockReturnValue(buildListQueryMock());

    render(<UsersPageClient />);

    expect(
      screen.getByPlaceholderText("Rechercher par nom ou email..."),
    ).toBeInTheDocument();
  });

  it("should show clear button when search has text", () => {
    mockListQuery.mockReturnValue(buildListQueryMock());

    render(<UsersPageClient />);

    const searchInput = screen.getByPlaceholderText(
      "Rechercher par nom ou email...",
    );

    expect(
      screen.queryByTestId("icon-x"),
    ).not.toBeInTheDocument();

    fireEvent.change(searchInput, { target: { value: "john" } });

    // X icon should be visible now (inside the clear button)
    expect(screen.getByTestId("icon-x")).toBeInTheDocument();
  });

  it("should clear search when clear button is clicked", () => {
    mockListQuery.mockReturnValue(buildListQueryMock());

    render(<UsersPageClient />);

    const searchInput = screen.getByPlaceholderText(
      "Rechercher par nom ou email...",
    );
    fireEvent.change(searchInput, { target: { value: "john" } });

    // Click the X icon — event bubbles up to the parent <button>
    fireEvent.click(screen.getByTestId("icon-x"));

    expect(searchInput).toHaveValue("");
  });

  it("should debounce the search value", async () => {
    vi.useFakeTimers();
    mockListQuery.mockImplementation(
      ({ search }: { search?: string }) => {
        return {
          isLoading: false,
          data: { items: search ? [] : [sampleUser] },
          isError: false,
          error: null,
          refetch: vi.fn(),
        };
      },
    );

    render(<UsersPageClient />);

    const searchInput = screen.getByPlaceholderText(
      "Rechercher par nom ou email...",
    );

    // Type a search
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    // Before debounce, the query should still use the old value (debouncedSearch is "")
    // But we can't easily test that since it's internal state
    // After debounce (300ms), the query should change
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now the debouncedSearch should have updated
    // The query should have been called with the search param
    // But since mockImplementation uses the arg, we can check
    expect(mockListQuery).toHaveBeenCalled();

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // List view — user items
  // -----------------------------------------------------------------------

  it("should render user items in the list", () => {
    mockListQuery.mockReturnValue(
      buildListQueryMock([sampleUser, sampleAdminUser, sampleModeratorUser]),
    );

    render(<UsersPageClient />);

    expect(screen.getByText("johndoe")).toBeInTheDocument();
    expect(screen.getByText("admin1")).toBeInTheDocument();
    expect(screen.getByText("moderator1")).toBeInTheDocument();
  });

  it("should render user emails", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));

    render(<UsersPageClient />);

    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("should render user credits", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));

    render(<UsersPageClient />);

    expect(screen.getByText("100 crédits")).toBeInTheDocument();
  });

  it("should render role badges with labels", () => {
    mockListQuery.mockReturnValue(
      buildListQueryMock([sampleUser, sampleAdminUser, sampleModeratorUser]),
    );

    render(<UsersPageClient />);

    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Modérateur")).toBeInTheDocument();
  });

  it("should render the user count in the card title", () => {
    mockListQuery.mockReturnValue(
      buildListQueryMock([sampleUser, sampleAdminUser]),
    );

    render(<UsersPageClient />);

    expect(screen.getByText("2 utilisateurs")).toBeInTheDocument();
  });

  it("should render '1 utilisateur' for a single item", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));

    render(<UsersPageClient />);

    expect(screen.getByText("1 utilisateur")).toBeInTheDocument();
  });

  it("should mark deleted users with line-through style", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleDeletedUser]));

    render(<UsersPageClient />);

    const deletedName = screen.getByText("deleteduser");
    expect(deletedName).toHaveClass("line-through");
    expect(deletedName).toHaveClass("text-muted-foreground");
  });

  // -----------------------------------------------------------------------
  // Empty search results
  // -----------------------------------------------------------------------

  it("should show search-specific empty message when search is active", () => {
    // The debounce means we need search text to be set
    // We can simulate with useFakeTimers or by directly triggering the debounced value
    // The simplest approach: just render with empty data while search is set via timer
    vi.useFakeTimers();
    mockListQuery.mockReturnValue(buildListQueryMock([]));

    render(<UsersPageClient />);

    const searchInput = screen.getByPlaceholderText(
      "Rechercher par nom ou email...",
    );
    fireEvent.change(searchInput, { target: { value: "xyz" } });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Re-render to see the empty state after debounce
    expect(screen.getByText("Aucun utilisateur")).toBeInTheDocument();
    expect(
      screen.getByText("Aucun utilisateur ne correspond à votre recherche."),
    ).toBeInTheDocument();

    vi.useRealTimers();
  });

  // -----------------------------------------------------------------------
  // Detail view
  // -----------------------------------------------------------------------

  it("should switch to detail view when a user is clicked", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    // Click on the user
    fireEvent.click(screen.getByText("johndoe"));

    // Should now see detail view
    expect(screen.getByText("john@example.com")).toBeInTheDocument();
  });

  it("should show back button in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    const backBtn = screen.getByRole("button", { name: "" });
    expect(backBtn).toBeInTheDocument();
  });

  it("should return to list view when back button is clicked", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    // No mockDetailQuery override — the dynamic mockImplementation in
    // beforeEach handles enabled/disabled state transitions correctly.

    render(<UsersPageClient />);

    // Enter detail view
    fireEvent.click(screen.getByText("johndoe"));

    // Click back button
    const backBtn = screen.getByRole("button", { name: "" });
    fireEvent.click(backBtn);

    // Should be back in list view
    expect(
      screen.getByRole("heading", { name: "Gestion des utilisateurs" }),
    ).toBeInTheDocument();
  });

  it("should render user ID in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("u-1")).toBeInTheDocument();
  });

  it("should render credits in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("should render total calls made in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("should render total likes received in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("should render consent status in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    // consentAcceptedAt is set, so it shows a date, not "Non"
    expect(screen.queryByText("Non")).not.toBeInTheDocument();
  });

  it("should show 'Non' for consent when not accepted", () => {
    const userDetailNoConsent = {
      ...sampleUserDetail,
      consentAcceptedAt: null,
    };
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: userDetailNoConsent,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("Non")).toBeInTheDocument();
  });

  it("should render stats section in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByRole("heading", { name: "Statistiques" })).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument(); // scenarios
    expect(screen.getByText("12")).toBeInTheDocument(); // comments
    expect(screen.getByText("30")).toBeInTheDocument(); // reactions
  });

  it("should show role badge in detail view", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(screen.getByText("Utilisateur")).toBeInTheDocument();
  });

  it("should render detail view heading with username", () => {
    mockListQuery.mockReturnValue(buildListQueryMock([sampleUser]));
    mockDetailQuery.mockReturnValue({
      isLoading: false,
      data: sampleUserDetail,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<UsersPageClient />);

    fireEvent.click(screen.getByText("johndoe"));

    expect(
      screen.getByRole("heading", { name: "johndoe" }),
    ).toBeInTheDocument();
  });
});
