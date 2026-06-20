import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Breadcrumbs } from "../Breadcrumbs";

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

vi.mock("lucide-react", () => ({
  Home: () => <svg data-testid="home-icon" aria-hidden="true" />,
  ChevronRight: () => <svg data-testid="chevron-icon" aria-hidden="true" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Breadcrumbs", () => {
  it("returns null for paths not starting with /dashboard or /admin", () => {
    mockUsePathname.mockReturnValue("/explore");
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when pathname starts with / but is not dashboard/admin", () => {
    mockUsePathname.mockReturnValue("/privacy");
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when only 1 segment (just /dashboard)", () => {
    mockUsePathname.mockReturnValue("/dashboard");
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null when only 1 segment (just /admin)", () => {
    mockUsePathname.mockReturnValue("/admin");
    const { container } = render(<Breadcrumbs />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders breadcrumbs for /dashboard/create", () => {
    mockUsePathname.mockReturnValue("/dashboard/create");
    render(<Breadcrumbs />);

    // Home link with aria-label
    const homeLink = screen.getByRole("link", { name: /accueil/i });
    expect(homeLink).toHaveAttribute("href", "/dashboard");

    // Segment labels from LABEL_MAP
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Créer")).toBeInTheDocument();

    // Last crumb should not be a link (aria-current="page")
    const lastCrumb = screen.getByText("Créer");
    expect(lastCrumb).toHaveAttribute("aria-current", "page");
  });

  it("renders breadcrumbs for /admin/settings", () => {
    mockUsePathname.mockReturnValue("/admin/settings");
    render(<Breadcrumbs />);

    expect(screen.getByText("Paramètres")).toBeInTheDocument();

    // Home link exists
    const homeLink = screen.getByRole("link", { name: /accueil/i });
    expect(homeLink).toHaveAttribute("href", "/dashboard");
  });

  it("renders correct hierarchy for multi-segment paths", () => {
    mockUsePathname.mockReturnValue("/dashboard/community/leaderboard");
    render(<Breadcrumbs />);

    // Home
    const homeLink = screen.getByRole("link", { name: /accueil/i });
    expect(homeLink).toBeInTheDocument();

    // All segments should be visible
    expect(screen.getByText("Communauté")).toBeInTheDocument();
    expect(screen.getByText("Classement")).toBeInTheDocument();

    // Classement is the last crumb → not a link
    const classement = screen.getByText("Classement");
    expect(classement).toHaveAttribute("aria-current", "page");
    expect(classement.tagName).toBe("SPAN");

    // Communauté is an intermediate crumb → should be a link
    const communaute = screen.getByText("Communauté").closest("a");
    expect(communaute).toHaveAttribute("href", "/dashboard/community");
  });

  it("renders fallback label (capitalized) for unknown segments", () => {
    mockUsePathname.mockReturnValue("/dashboard/unknown-segment");
    render(<Breadcrumbs />);

    // The segment "unknown-segment" is not in LABEL_MAP, so it capitalizes
    expect(screen.getByText("Unknown-segment")).toBeInTheDocument();
  });

  it("home link has correct aria-label", () => {
    mockUsePathname.mockReturnValue("/dashboard/create");
    render(<Breadcrumbs />);

    const homeLink = screen.getByRole("link", { name: "Accueil" });
    expect(homeLink).toHaveAttribute("aria-label", "Accueil");
    expect(homeLink.querySelector("svg")).toBeInTheDocument();
  });

  it("renders Home icon in the first list item", () => {
    mockUsePathname.mockReturnValue("/dashboard/create");
    render(<Breadcrumbs />);

    const homeIcon = screen.getByTestId("home-icon");
    expect(homeIcon).toBeInTheDocument();
    expect(homeIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("sets proper aria-label on navigation element", () => {
    mockUsePathname.mockReturnValue("/dashboard/create");
    render(<Breadcrumbs />);

    const nav = screen.getByRole("navigation", { name: "Fil d'Ariane" });
    expect(nav).toBeInTheDocument();
  });
});
