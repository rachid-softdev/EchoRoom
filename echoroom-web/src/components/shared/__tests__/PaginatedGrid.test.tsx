import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PaginatedGrid } from "../PaginatedGrid";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: () => <svg data-testid="spinner-icon" className="animate-spin" />,
  ArrowDown: () => <svg data-testid="arrow-down-icon" />,
}));

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PaginatedGrid", () => {
  it("renders children in a grid", () => {
    render(
      <PaginatedGrid hasMore={false} isLoadingMore={false} onLoadMore={vi.fn()}>
        <div data-testid="child-1">Item 1</div>
        <div data-testid="child-2">Item 2</div>
      </PaginatedGrid>,
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("shows 'Voir plus' button when hasMore is true", () => {
    render(
      <PaginatedGrid hasMore={true} isLoadingMore={false} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    expect(screen.getByRole("button", { name: /voir plus/i })).toBeInTheDocument();
  });

  it("hides 'Voir plus' button when hasMore is false", () => {
    render(
      <PaginatedGrid hasMore={false} isLoadingMore={false} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    expect(screen.queryByRole("button", { name: /voir plus/i })).not.toBeInTheDocument();
  });

  it("calls onLoadMore when button is clicked", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();

    render(
      <PaginatedGrid hasMore={true} isLoadingMore={false} onLoadMore={onLoadMore}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    const button = screen.getByRole("button", { name: /voir plus/i });
    await user.click(button);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("shows spinner icon when isLoadingMore is true", () => {
    render(
      <PaginatedGrid hasMore={true} isLoadingMore={true} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    const spinner = screen.getByTestId("spinner-icon");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("animate-spin");

    // ArrowDown should not be present
    expect(screen.queryByTestId("arrow-down-icon")).not.toBeInTheDocument();
  });

  it("disables button when isLoadingMore is true", () => {
    render(
      <PaginatedGrid hasMore={true} isLoadingMore={true} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    const button = screen.getByRole("button", { name: /voir plus/i });
    expect(button).toBeDisabled();
  });

  it("shows ArrowDown icon when not loading", () => {
    render(
      <PaginatedGrid hasMore={true} isLoadingMore={false} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    expect(screen.getByTestId("arrow-down-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("spinner-icon")).not.toBeInTheDocument();
  });

  it("does not call onLoadMore when button is clicked while loading", async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();

    render(
      <PaginatedGrid hasMore={true} isLoadingMore={true} onLoadMore={onLoadMore}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    const button = screen.getByRole("button", { name: /voir plus/i });
    expect(button).toBeDisabled();

    await user.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("renders grid with correct responsive classes", () => {
    const { container } = render(
      <PaginatedGrid hasMore={false} isLoadingMore={false} onLoadMore={vi.fn()}>
        <div>Item</div>
      </PaginatedGrid>,
    );

    const grid = container.querySelector(".grid");
    expect(grid).toHaveClass("md:grid-cols-2");
    expect(grid).toHaveClass("lg:grid-cols-3");
    expect(grid).toHaveClass("gap-4");
  });
});
