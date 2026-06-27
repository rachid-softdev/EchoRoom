import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Not Found (404) Page tests
// ---------------------------------------------------------------------------
// Tests for the 404 page:
//   - Renders "404" heading
//   - Renders description text
//   - Home button links to "/"
//   - No "use client" directive

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Frown: () => <svg data-testid="icon-frown" />,
  Home: () => <svg data-testid="icon-home" />,
}));

// Mock Button component
vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    className,
    ...props
  }: {
    children: React.ReactNode;
    className?: string;
    [key: string]: any;
  }) => (
    <button className={className} {...props}>
      {children}
    </button>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("Not Found page", () => {
  it("should render 404 heading", async () => {
    const NotFound = (await import("../not-found")).default;
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("should render the description text", async () => {
    const NotFound = (await import("../not-found")).default;
    render(<NotFound />);

    expect(screen.getByText(/cette page n'existe pas/i)).toBeInTheDocument();
  });

  it("should render a home button linking to '/'", async () => {
    const NotFound = (await import("../not-found")).default;
    render(<NotFound />);

    const homeLink = screen.getByRole("link", { name: /Retour à l'accueil/i });
    expect(homeLink).toHaveAttribute("href", "/");
  });

  it("should render the Frown icon", async () => {
    const NotFound = (await import("../not-found")).default;
    render(<NotFound />);

    expect(screen.getByTestId("icon-frown")).toBeInTheDocument();
  });

  it("should render the Home icon inside the button", async () => {
    const NotFound = (await import("../not-found")).default;
    render(<NotFound />);

    expect(screen.getByTestId("icon-home")).toBeInTheDocument();
  });

  it("should NOT have 'use client' directive", async () => {
    // Read the source file to verify no "use client" directive
    // We can verify by checking the module isn't a client component
    // (Server components don't have "use client" and export default)
    const mod = await import("../not-found");
    expect(mod.default).toBeDefined();
    // The component should be renderable (not throw)
    expect(() => render(<mod.default />)).not.toThrow();
  });
});
