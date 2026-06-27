import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "../ThemeProvider";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseTheme = vi.fn();

vi.mock("next-themes", () => ({
  ThemeProvider: ({
    children,
    attribute,
    defaultTheme,
    enableSystem,
    storageKey,
    disableTransitionOnChange,
  }: {
    children: React.ReactNode;
    attribute?: string;
    defaultTheme?: string;
    enableSystem?: boolean;
    storageKey?: string;
    disableTransitionOnChange?: boolean;
  }) => (
    <div
      data-testid="next-themes-provider"
      data-attribute={attribute}
      data-default-theme={defaultTheme}
      data-enable-system={String(enableSystem)}
      data-storage-key={storageKey}
      data-disable-transition={String(disableTransitionOnChange)}
    >
      {children}
    </div>
  ),
  useTheme: () => mockUseTheme(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ThemeProvider", () => {
  it("renders children inside the NextThemesProvider", () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Hello</div>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });

  it("passes correct props to NextThemesProvider", () => {
    render(
      <ThemeProvider>
        <div>Content</div>
      </ThemeProvider>,
    );

    const provider = screen.getByTestId("next-themes-provider");
    expect(provider).toHaveAttribute("data-attribute", "class");
    expect(provider).toHaveAttribute("data-default-theme", "dark");
    expect(provider).toHaveAttribute("data-enable-system", "false");
    expect(provider).toHaveAttribute("data-storage-key", "echoroom-theme");
    expect(provider).toHaveAttribute("data-disable-transition", "true");
  });

  it("renders multiple children", () => {
    render(
      <ThemeProvider>
        <span data-testid="child1">First</span>
        <span data-testid="child2">Second</span>
      </ThemeProvider>,
    );

    expect(screen.getByTestId("child1")).toBeInTheDocument();
    expect(screen.getByTestId("child2")).toBeInTheDocument();
  });

  it("renders without children (empty fragment)", () => {
    const { container } = render(<ThemeProvider>{null}</ThemeProvider>);

    // The provider should still render
    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
    expect(container.textContent).toBe("");
  });
});
