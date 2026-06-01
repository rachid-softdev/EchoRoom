import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// ---------------------------------------------------------------------------
// RootLayout tests — skip link accessibility (S-5 fix)
// ---------------------------------------------------------------------------
// Tests that the layout contains:
//   1. A skip-to-content link (<a href="#main-content">)
//   2. A <div id="main-content"> with tabIndex={-1}

// Mock next-auth SessionProvider — renders children directly
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: any) => <>{children}</>,
}));

// Mock tRPC provider — renders children directly
vi.mock("@/lib/trpc-provider", () => ({
  TRPCReactProvider: ({ children }: any) => <>{children}</>,
}));

// Mock ToastProvider and Toaster — renders children directly
vi.mock("@/components/ui", () => ({
  ToastProvider: ({ children }: any) => <>{children}</>,
  Toaster: () => null,
}));

// Mock ThemeProvider — renders children directly (jsdom lacks window.matchMedia)
vi.mock("@/components/providers/ThemeProvider", () => ({
  ThemeProvider: ({ children }: any) => <>{children}</>,
}));

// Mock Footer — renders a simple placeholder
vi.mock("@/components/shared/Footer", () => ({
  Footer: () => <footer data-testid="footer" />,
}));

// Mock ConsentBanner — renders nothing (avoids tRPC dependency in layout test)
vi.mock("@/components/shared/ConsentBanner", () => ({
  ConsentBanner: () => null,
}));

// Mock Inter font — returns a simple variable string
vi.mock("next/font/google", () => ({
  Inter: () => ({
    variable: "--font-inter",
    className: "font-inter",
  }),
}));

afterEach(() => {
  cleanup();
});

describe("RootLayout — skip link accessibility", () => {
  let RootLayout: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../layout");
    RootLayout = mod.default;
  });

  it("renders a skip-to-content link with href='#main-content'", () => {
    render(<RootLayout><div>Test content</div></RootLayout>);

    const skipLink = screen.getByRole("link", {
      name: /Aller au contenu principal/i,
    });
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("renders the skip link with sr-only class (visually hidden until focused)", () => {
    render(<RootLayout><div>Test content</div></RootLayout>);

    const skipLink = screen.getByRole("link", {
      name: /Aller au contenu principal/i,
    });
    // Should have sr-only class (screen-reader only, visible on focus)
    expect(skipLink.className).toContain("sr-only");
    expect(skipLink.className).toContain("focus:not-sr-only");
  });

  it("renders the main content div with id='main-content'", () => {
    render(<RootLayout><div>Test content</div></RootLayout>);

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toHaveAttribute("id", "main-content");
  });

  it("renders the main content div with tabIndex={-1}", () => {
    render(<RootLayout><div>Test content</div></RootLayout>);

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toBeInTheDocument();
    expect(mainContent).toHaveAttribute("tabindex", "-1");
  });

  it("renders children inside the main-content div", () => {
    render(
      <RootLayout>
        <div data-testid="child-content">Hello World</div>
      </RootLayout>,
    );

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toContainHTML("Hello World");
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders the Footer component inside main-content", () => {
    render(<RootLayout><div>Test</div></RootLayout>);

    const footer = screen.getByTestId("footer");
    expect(footer).toBeInTheDocument();

    const mainContent = document.getElementById("main-content");
    expect(mainContent).toContainElement(footer);
  });

  it("renders html element with lang='fr'", () => {
    const { container } = render(<RootLayout><div>Test</div></RootLayout>);

    // jsdom creates a default html element, so the component's html is a child
    // Verify the rendered output contains the expected attribute
    expect(container.innerHTML).toContain('lang="fr"');
  });
});
