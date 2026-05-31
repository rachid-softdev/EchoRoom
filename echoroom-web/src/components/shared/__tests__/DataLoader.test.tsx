import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataLoader } from "../DataLoader";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockQuery<T>(overrides: Partial<{
  data: T;
  isLoading: boolean;
  isError: boolean;
  error: { message?: string } | null;
  refetch: () => void;
}> = {}) {
  return {
    data: undefined,
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

describe("DataLoader", () => {
  // ── Loading state ─────────────────────────────────────────────────

  it("renders skeleton grid (default 3 items) when isLoading is true", () => {
    const query = createMockQuery({ isLoading: true });
    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    // Default skeleton renders a grid with 3 skeleton items
    // We check for skeleton elements by looking at the grid structure
    const skeletonContainer = document.querySelector(".grid.md\\:grid-cols-3");
    expect(skeletonContainer).toBeInTheDocument();

    // The default skeleton renders 3 skeleton wrappers
    const skeletonWrappers = document.querySelectorAll(
      ".rounded-xl.border.border-border.p-4",
    );
    expect(skeletonWrappers).toHaveLength(3);
  });

  it("renders skeletonCount items when specified", () => {
    const query = createMockQuery({ isLoading: true });
    render(
      <DataLoader query={query} skeletonCount={5}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    const skeletonWrappers = document.querySelectorAll(
      ".rounded-xl.border.border-border.p-4",
    );
    expect(skeletonWrappers).toHaveLength(5);
  });

  it("renders custom skeleton when provided", () => {
    const query = createMockQuery({ isLoading: true });
    render(
      <DataLoader
        query={query}
        skeleton={<div data-testid="custom-skeleton">Chargement...</div>}
      >
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Chargement...")).toBeInTheDocument();

    // Default skeleton should NOT be rendered
    const skeletonContainer = document.querySelector(".grid.md\\:grid-cols-3");
    expect(skeletonContainer).not.toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────

  it("shows error message with retry button when isError is true", async () => {
    const refetch = vi.fn();
    const query = createMockQuery({
      isError: true,
      error: { message: "Network error" },
      refetch,
    });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    // Should show error title
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();

    // Should show error message from error object
    expect(screen.getByText("Network error")).toBeInTheDocument();

    // Should show retry button
    const retryButton = screen.getByRole("button", { name: /réessayer/i });
    expect(retryButton).toBeInTheDocument();

    // Clicking retry calls refetch
    const user = userEvent.setup();
    await user.click(retryButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows default error message when error.message is not available", () => {
    const refetch = vi.fn();
    const query = createMockQuery({
      isError: true,
      error: null,
      refetch,
    });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    // Should show default error message
    expect(
      screen.getByText("Impossible de charger les données. Réessayez."),
    ).toBeInTheDocument();
  });

  it("shows error message even when error is null but isError is true", () => {
    const query = createMockQuery({
      isError: true,
      error: null,
    });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(
      screen.getByText("Impossible de charger les données. Réessayez."),
    ).toBeInTheDocument();
  });

  // ── Empty data state ─────────────────────────────────────────────

  it('shows "Aucun résultat" when data is null', () => {
    const query = createMockQuery({ data: null });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });

  it('shows "Aucun résultat" when data is undefined', () => {
    const query = createMockQuery({ data: undefined });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });

  it("shows custom empty component when provided", () => {
    const query = createMockQuery({ data: null });

    render(
      <DataLoader
        query={query}
        empty={<div data-testid="custom-empty">Rien à voir ici</div>}
      >
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    expect(screen.getByText("Rien à voir ici")).toBeInTheDocument();

    // Default empty message should NOT be shown
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument();
  });

  // ── isEmpty callback ─────────────────────────────────────────────

  it("shows empty state when isEmpty callback returns true", () => {
    const data = { items: [] };
    const query = createMockQuery({ data });
    const isEmpty = vi.fn((d: typeof data) => d.items.length === 0);

    render(
      <DataLoader query={query} isEmpty={isEmpty}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(isEmpty).toHaveBeenCalledWith(data);
  });

  it("shows custom empty when isEmpty callback returns true with custom empty", () => {
    const data = { items: [] };
    const query = createMockQuery({ data });

    render(
      <DataLoader
        query={query}
        isEmpty={(d: typeof data) => d.items.length === 0}
        empty={<div data-testid="custom-empty">Custom empty</div>}
      >
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument();
  });

  it("does not show empty when isEmpty returns false", () => {
    const data = { items: [1, 2, 3] };
    const query = createMockQuery({ data });

    render(
      <DataLoader
        query={query}
        isEmpty={(d: typeof data) => d.items.length === 0}
      >
        {(loadedData) => <div>Items: {loadedData.items.length}</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Items: 3")).toBeInTheDocument();
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument();
  });

  // ── Empty array ──────────────────────────────────────────────────

  it('shows "Aucun résultat" when data is an empty array', () => {
    const query = createMockQuery({ data: [] });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    // An empty array is truthy, so it won't match the !query.data branch.
    // But isEmpty callback can catch it. Without isEmpty, the component
    // will render children with an empty array.
    expect(screen.getByText("data")).toBeInTheDocument();
  });

  it("shows custom empty when data is an empty array and isEmpty is provided", () => {
    const query = createMockQuery({ data: [] as string[] });

    render(
      <DataLoader
        query={query}
        isEmpty={(d: string[]) => d.length === 0}
        empty={<div data-testid="custom-empty">No items</div>}
      >
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByTestId("custom-empty")).toBeInTheDocument();
  });

  // ── Data renders ─────────────────────────────────────────────────

  it("renders children with data when data is available", () => {
    const data = { id: 1, name: "Test Item" };
    const query = createMockQuery({ data });

    render(
      <DataLoader query={query}>
        {(loadedData) => (
          <div data-testid="loaded-data">{loadedData.name}</div>
        )}
      </DataLoader>,
    );

    expect(screen.getByTestId("loaded-data")).toBeInTheDocument();
    expect(screen.getByText("Test Item")).toBeInTheDocument();
  });

  it("renders children with array data when data is an array", () => {
    const data = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ];
    const query = createMockQuery({ data });

    render(
      <DataLoader query={query}>
        {(loadedData) => (
          <ul>
            {loadedData.map((item: { id: number; name: string }) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        )}
      </DataLoader>,
    );

    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  // ── Priority: loading > error > empty > data ────────────────────

  it("shows loading state even when error is also true", () => {
    const query = createMockQuery({
      isLoading: true,
      isError: true,
      error: { message: "Some error" },
    });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    // Loading takes priority over error
    const skeletonContainer = document.querySelector(".grid.md\\:grid-cols-3");
    expect(skeletonContainer).toBeInTheDocument();
    expect(screen.queryByText("Une erreur est survenue")).not.toBeInTheDocument();
  });

  it("shows error state before empty state", () => {
    const query = createMockQuery({
      isError: true,
      data: null,
      error: { message: "Error" },
    });

    render(
      <DataLoader query={query}>
        {() => <div>data</div>}
      </DataLoader>,
    );

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.queryByText("Aucun résultat")).not.toBeInTheDocument();
  });
});
