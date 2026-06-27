import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUsePathname = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PublicHeader", () => {
  let PublicHeader: typeof import("../PublicHeader").PublicHeader;

  beforeEach(async () => {
    const mod = await import("../PublicHeader");
    PublicHeader = mod.PublicHeader;
  });

  // ── Null cases ────────────────────────────────────────────────────

  it("returns null for pathname starting with /dashboard", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for pathname starting with /dashboard/subroute", () => {
    mockUsePathname.mockReturnValue("/dashboard/settings");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for pathname starting with /admin", () => {
    mockUsePathname.mockReturnValue("/admin");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for pathname starting with /admin/users", () => {
    mockUsePathname.mockReturnValue("/admin/users");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for /explore", () => {
    mockUsePathname.mockReturnValue("/explore");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for /pricing", () => {
    mockUsePathname.mockReturnValue("/pricing");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for /login", () => {
    mockUsePathname.mockReturnValue("/login");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for /register", () => {
    mockUsePathname.mockReturnValue("/register");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for paths starting with /terms", () => {
    mockUsePathname.mockReturnValue("/terms");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for paths starting with /privacy", () => {
    mockUsePathname.mockReturnValue("/privacy");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for paths starting with /legal", () => {
    mockUsePathname.mockReturnValue("/legal");
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when pathname is null", () => {
    mockUsePathname.mockReturnValue(null);
    const { container } = render(<PublicHeader />);
    expect(container).toBeEmptyDOMElement();
  });

  // ── Render cases ──────────────────────────────────────────────────

  it("renders header for root path /", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    expect(screen.getByText("EchoRoom")).toBeInTheDocument();
  });

  it("renders header for a non-excluded path", () => {
    mockUsePathname.mockReturnValue("/some-other-page");
    render(<PublicHeader />);

    expect(screen.getByText("EchoRoom")).toBeInTheDocument();
  });

  it("renders EchoRoom link pointing to /", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    const brandLink = screen.getByText("EchoRoom").closest("a");
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("renders Explorer link with correct href", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    const explorerLink = screen.getByRole("link", { name: "Explorer" });
    expect(explorerLink).toHaveAttribute("href", "/explore");
  });

  it("renders Classement link with correct href", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    const classementLink = screen.getByRole("link", { name: "Classement" });
    expect(classementLink).toHaveAttribute("href", "/community/leaderboard");
  });

  it("renders Aide link with correct href", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    const aideLink = screen.getByRole("link", { name: "Aide" });
    expect(aideLink).toHaveAttribute("href", "/help");
  });

  it("renders ThemeToggle component", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders navigation with all three links", () => {
    mockUsePathname.mockReturnValue("/");
    render(<PublicHeader />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();

    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveTextContent("Explorer");
    expect(links[1]).toHaveTextContent("Classement");
    expect(links[2]).toHaveTextContent("Aide");
  });
});
