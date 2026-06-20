import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BadgeGrid } from "../BadgeGrid";

// ---------------------------------------------------------------------------
// Mock BadgeDisplay to isolate BadgeGrid tests
// ---------------------------------------------------------------------------

vi.mock("../BadgeDisplay", () => ({
  BadgeDisplay: ({ userId }: { userId: string }) => (
    <div data-testid="badge-display">{userId}</div>
  ),
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BadgeGrid", () => {
  it("renders BadgeDisplay with the correct userId", () => {
    render(<BadgeGrid userId="user-123" />);

    const display = screen.getByTestId("badge-display");
    expect(display).toBeInTheDocument();
    expect(display).toHaveTextContent("user-123");
  });

  it("passes a different userId correctly", () => {
    render(<BadgeGrid userId="user-456" />);

    const display = screen.getByTestId("badge-display");
    expect(display).toHaveTextContent("user-456");
  });

  it("renders a single BadgeDisplay component", () => {
    render(<BadgeGrid userId="user-789" />);

    const displays = screen.getAllByTestId("badge-display");
    expect(displays).toHaveLength(1);
  });

  it("does not render extra wrapping elements", () => {
    const { container } = render(<BadgeGrid userId="user-1" />);

    // The component should only render the BadgeDisplay div directly
    // Container firstChild should be the mocked div with no extra wrapper
    expect(container.firstChild).toBe(screen.getByTestId("badge-display"));
  });
});
