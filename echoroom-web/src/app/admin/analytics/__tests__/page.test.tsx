import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next/link (server component usage)
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons used by the analytics page
vi.mock("lucide-react", () => ({
  BarChart3: () => <svg data-testid="icon-bar-chart3" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  ArrowUpRight: () => <svg data-testid="icon-arrow-up-right" />,
}));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("AnalyticsPage (server component)", () => {
  let AnalyticsPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    AnalyticsPage = mod.default;
  });

  // -----------------------------------------------------------------------
  // Title & header
  // -----------------------------------------------------------------------

  it("should render the page title", () => {
    render(<AnalyticsPage />);

    expect(
      screen.getByRole("heading", { name: "Analytiques" }),
    ).toBeInTheDocument();
  });

  it("should render the live statistics badge", () => {
    render(<AnalyticsPage />);

    expect(
      screen.getByText("Statistiques en cours"),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Stat cards grid
  // -----------------------------------------------------------------------

  it("should render all 4 stat cards with labels", () => {
    render(<AnalyticsPage />);

    expect(screen.getByText("Utilisateurs total")).toBeInTheDocument();
    expect(screen.getByText("Appels total")).toBeInTheDocument();
    expect(screen.getByText("Scénarios créés")).toBeInTheDocument();
    expect(screen.getByText("Revenus")).toBeInTheDocument();
  });

  it("should render placeholder text on each stat card", () => {
    render(<AnalyticsPage />);

    const placeholders = screen.getAllByText(
      "Données disponibles après le déploiement",
    );
    expect(placeholders).toHaveLength(4);
  });

  // -----------------------------------------------------------------------
  // Roadmap card
  // -----------------------------------------------------------------------

  it("should render the roadmap card title", () => {
    render(<AnalyticsPage />);

    expect(
      screen.getByRole("heading", { name: "Tableau de bord analytique" }),
    ).toBeInTheDocument();
  });

  it("should render the roadmap description", () => {
    render(<AnalyticsPage />);

    expect(
      screen.getByText(
        /Les statistiques détaillées seront disponibles dans une prochaine mise à jour/,
      ),
    ).toBeInTheDocument();
  });

  it("should render the roadmap feature list items", () => {
    render(<AnalyticsPage />);

    expect(
      screen.getByText(/Évolution des inscriptions/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Appels générés et minutes cumulées/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Crédits consommés et revenus/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Top scénarios, personnages et créateurs/),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Admin navigation links
  // -----------------------------------------------------------------------

  it("should render the admin navigation link to users page", () => {
    render(<AnalyticsPage />);

    const link = screen.getByRole("link", {
      name: /Gestion des utilisateurs/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/users");
  });

  it("should render the admin navigation link to moderation page", () => {
    render(<AnalyticsPage />);

    const link = screen.getByRole("link", {
      name: /Modération/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/moderation");
  });

  it("should render the admin navigation link to reports page", () => {
    render(<AnalyticsPage />);

    const link = screen.getByRole("link", {
      name: /Signalements/,
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/reports");
  });
});
