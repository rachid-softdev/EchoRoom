import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

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

// Mock CreditDisplay
vi.mock("@/components/shared/CreditDisplay", () => ({
  CreditDisplay: () => <div data-testid="credit-display">Crédits</div>,
}));

// Mock ThemeToggle
vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme</div>,
}));

// Mock Breadcrumbs
vi.mock("@/components/shared/Breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs">Breadcrumbs</nav>,
}));

// Mock Button and cn
vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    variant,
    size,
    href,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    href?: string;
    [key: string]: unknown;
  }) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DashboardShell", () => {
  let DashboardShell: typeof import("../DashboardShell").DashboardShell;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../DashboardShell");
    DashboardShell = mod.DashboardShell;
  });

  // ── Title ─────────────────────────────────────────────────────────

  it("renders the title", () => {
    render(
      <DashboardShell title="Mon Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByRole("heading", { name: /mon dashboard/i })).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(
      <DashboardShell title="Dashboard" subtitle="Sous-titre">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByText("Sous-titre")).toBeInTheDocument();
  });

  it("does not render subtitle when not provided", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.queryByText("Sous-titre")).not.toBeInTheDocument();
  });

  // ── Children ──────────────────────────────────────────────────────

  it("renders children", () => {
    render(
      <DashboardShell title="Dashboard">
        <div data-testid="child">Child content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  // ── Navigation links ──────────────────────────────────────────────

  it("renders all navigation links", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    const navLabels = [
      "Dashboard",
      "Créer",
      "Bibliothèque",
      "Historique",
      "Communauté",
      "Classement",
      "Facturation",
    ];

    for (const label of navLabels) {
      const elements = screen.getAllByText(label);
      expect(elements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("marks active link based on pathname", () => {
    mockPathname.mockReturnValue("/dashboard");

    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    // Find the first link containing "Dashboard" in the nav bar
    const dashboardLinks = screen.getAllByText("Dashboard");
    const navDashboardLink = dashboardLinks.find(
      (el) => el.closest("a") && el.closest("a")!.getAttribute("aria-current") === "page",
    );
    expect(navDashboardLink).toBeTruthy();
  });

  it("marks nested route as active", () => {
    mockPathname.mockReturnValue("/library/favorites");

    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    const libraryLink = screen.getByText("Bibliothèque").closest("a");
    expect(libraryLink).toHaveAttribute("aria-current", "page");
  });

  it("does not mark dashboard as active for sub-routes starting with /d", () => {
    // The logic uses startsWith, so "/dashboard" is exact match only for dashboard
    // Other routes like "/dashboard" itself is the only match
    mockPathname.mockReturnValue("/dashboard");

    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    const createLink = screen.getByText("Créer").closest("a");
    expect(createLink).not.toHaveAttribute("aria-current");
  });

  // ── Brand/Logo ────────────────────────────────────────────────────

  it("renders EchoRoom brand with link to dashboard", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    const brandLink = screen.getByRole("link", { name: /echoroom/i });
    expect(brandLink).toHaveAttribute("href", "/dashboard");
  });

  // ── Settings button ───────────────────────────────────────────────

  it("renders settings button with link to settings page", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    // The Link wraps a Button with aria-label="Paramètres".
    // The button has the accessible name, not the link.
    const settingsButton = screen.getByRole("button", { name: /paramètres/i });
    expect(settingsButton).toBeInTheDocument();

    // The button is inside a link to /settings
    const settingsLink = settingsButton.closest("a");
    expect(settingsLink).toHaveAttribute("href", "/settings");
  });

  // ── Sub-components ────────────────────────────────────────────────

  it("renders CreditDisplay", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("credit-display")).toBeInTheDocument();
  });

  it("renders ThemeToggle", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders Breadcrumbs", () => {
    render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
  });

  // ── Actions ───────────────────────────────────────────────────────

  it("renders actions when provided", () => {
    render(
      <DashboardShell title="Dashboard" actions={<button type="button" data-testid="action-btn">Action</button>}>
        <div>Content</div>
      </DashboardShell>,
    );

    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
  });

  // ── Full width content area ───────────────────────────────────────

  it("renders with max-width container", () => {
    const { container } = render(
      <DashboardShell title="Dashboard">
        <div>Content</div>
      </DashboardShell>,
    );

    const sections = container.querySelectorAll("section");
    expect(sections.length).toBeGreaterThanOrEqual(1);

    // Check for max-w-6xl class
    const section = sections[0];
    expect(section!.className).toContain("max-w-6xl");
  });
});
