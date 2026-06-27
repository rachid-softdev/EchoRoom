import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSession: { data: unknown; status: string } = {
  data: null,
  status: "unauthenticated",
};

vi.mock("next-auth/react", () => ({
  useSession: () => mockSession,
}));

// Mock next/link to render as a simple <a> tag
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockSession = { data: null, status: "unauthenticated" };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MarketingNav", () => {
  let MarketingNav: typeof import("../MarketingNav").MarketingNav;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../MarketingNav");
    MarketingNav = mod.MarketingNav;
  });

  it("renders the logo/brand name", () => {
    render(<MarketingNav />);

    const brandLink = screen.getByRole("link", { name: /echoroom/i });
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("renders the Connexion button when user is not authenticated", () => {
    mockSession = { data: null, status: "unauthenticated" };

    render(<MarketingNav />);

    const loginLink = screen.getByRole("link", { name: /connexion/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders the Dashboard link when user is authenticated", () => {
    mockSession = {
      data: { user: { name: "Test User" } },
      status: "authenticated",
    };

    render(<MarketingNav />);

    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders a loading spinner when session status is loading", () => {
    mockSession = { data: null, status: "loading" };

    render(<MarketingNav />);

    // Should show a disabled button with spinner (no accessible name, just a spinner)
    const loadingButton = screen.getByRole("button");
    expect(loadingButton).toBeDisabled();
    expect(loadingButton.querySelector("svg")).toBeInTheDocument();
  });

  it("does not show login button when loading", () => {
    mockSession = { data: null, status: "loading" };

    render(<MarketingNav />);

    expect(screen.queryByRole("link", { name: /connexion/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("does not show dashboard link when unauthenticated", () => {
    mockSession = { data: null, status: "unauthenticated" };

    render(<MarketingNav />);

    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
  });

  it("has the sticky header class", () => {
    render(<MarketingNav />);

    const header = document.querySelector("header");
    expect(header).toBeInTheDocument();
    expect(header?.className).toContain("sticky");
    expect(header?.className).toContain("top-0");
    expect(header?.className).toContain("z-50");
  });
});
