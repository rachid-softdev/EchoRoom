import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaginatedDataLoader } from "../PaginatedDataLoader";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockQuery<T>(overrides: Partial<{
  items: T[];
  isLoading: boolean;
  isError: boolean;
  error: { message?: string } | null;
  refetch: () => void;
}> = {}) {
  return {
    items: [] as T[],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaginatedDataLoader", () => {
  // ── Loading state ─────────────────────────────────────────────────

  it("renders default loading spinner when isLoading is true", () => {
    const query = createMockQuery({ isLoading: true });

    render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    // Default loading shows a spinner icon
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    expect(screen.queryByText("items")).not.toBeInTheDocument();
  });

  it("renders custom loading skeleton when provided", () => {
    const query = createMockQuery({ isLoading: true });

    render(
      <PaginatedDataLoader
        query={query}
        loadingSkeleton={<div data-testid="custom-loader">Loading...</div>}
      >
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    expect(screen.getByTestId("custom-loader")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();

    // Default spinner should NOT be rendered
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────

  it("shows error message with retry button when isError is true", async () => {
    const refetch = vi.fn();
    const query = createMockQuery({
      isError: true,
      error: { message: "Failed to load" },
      refetch,
    });

    render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Failed to load")).toBeInTheDocument();

    const retryButton = screen.getByRole("button", { name: /réessayer/i });
    expect(retryButton).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(retryButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows default error message when error.message is not available", () => {
    const query = createMockQuery({
      isError: true,
      error: null,
    });

    render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    expect(
      screen.getByText("Impossible de charger les données"),
    ).toBeInTheDocument();
  });

  // ── Empty state ──────────────────────────────────────────────────

  it("renders nothing when items array is empty and no empty prop", () => {
    const query = createMockQuery({ items: [] });

    const { container } = render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    // When items is empty and no empty prop, it renders empty fragment (nothing)
    expect(container.textContent).toBe("");
    expect(screen.queryByText("items")).not.toBeInTheDocument();
  });

  it("renders custom empty component when items array is empty", () => {
    const query = createMockQuery({ items: [] });

    render(
      <PaginatedDataLoader
        query={query}
        empty={<div data-testid="custom-empty">No items found</div>}
      >
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  // ── Data renders ─────────────────────────────────────────────────

  it("renders children with items when items are available", () => {
    const items = [
      { id: 1, name: "Item A" },
      { id: 2, name: "Item B" },
      { id: 3, name: "Item C" },
    ];
    const query = createMockQuery({ items });

    render(
      <PaginatedDataLoader query={query}>
        {(loadedItems) => (
          <ul>
            {loadedItems.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
      </PaginatedDataLoader>,
    );

    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
    expect(screen.getByText("Item C")).toBeInTheDocument();
  });

  it("renders children with a single item", () => {
    const items = [{ id: 1, name: "Only Item" }];
    const query = createMockQuery({ items });

    render(
      <PaginatedDataLoader query={query}>
        {(loadedItems) => <div data-testid="result">{loadedItems[0]!.name}</div>}
      </PaginatedDataLoader>,
    );

    expect(screen.getByTestId("result")).toBeInTheDocument();
    expect(screen.getByText("Only Item")).toBeInTheDocument();
  });

  // ── Priority: error > loading > empty > data ────────────────────

  it("shows error state even when also loading", () => {
    const query = createMockQuery({
      isError: true,
      isLoading: true,
      error: { message: "Error occurred" },
    });

    render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    // Error takes priority
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).not.toBeInTheDocument();
  });

  it("shows loading state before empty state", () => {
    const query = createMockQuery({
      isLoading: true,
      items: [],
    });

    render(
      <PaginatedDataLoader query={query}>
        {() => <div>items</div>}
      </PaginatedDataLoader>,
    );

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });
});
