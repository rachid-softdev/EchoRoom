import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next-auth
const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    dashboard: {
      getData: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/dashboard"),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Phone: () => <svg data-testid="icon-phone" />,
  Plus: () => <svg data-testid="icon-plus" />,
  Library: () => <svg data-testid="icon-library" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Users: () => <svg data-testid="icon-users" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  Medal: () => <svg data-testid="icon-medal" />,
  Shuffle: () => <svg data-testid="icon-shuffle" />,
  Zap: () => <svg data-testid="icon-zap" />,
  MessageCircle: () => <svg data-testid="icon-message-circle" />,
  Flame: () => <svg data-testid="icon-flame" />,
}));

// Mock sub-components used by dashboard
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) =>
    <div data-testid="dashboard-shell" data-title={title}>{children}</div>,
}));

vi.mock("@/components/social/FeaturedScenario", () => ({
  FeaturedScenario: () => <div data-testid="featured-scenario" />,
}));

vi.mock("@/components/social/BadgeGrid", () => ({
  BadgeGrid: ({ userId }: { userId: string }) => <div data-testid="badge-grid" data-user-id={userId} />,
}));

// Mock @/components/ui (Card, Badge, Button)
vi.mock("@/components/ui", () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>{children}</span>
  ),
  Button: ({ children, onClick, variant, className, size, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} className={className} {...props}>{children}</button>
  ),
  Card: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardDescription: ({ children, className, ...props }: any) => <p className={className} {...props}>{children}</p>,
  CardHeader: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardTitle: ({ children, className, ...props }: any) => <h3 className={className} {...props}>{children}</h3>,
}));

vi.mock("@/lib/constants", () => ({
  STATUS_LABELS: {
    COMPLETED: "Terminé",
    FAILED: "Échoué",
    ACTIVE: "Actif",
  },
  formatDate: () => "1 juin 2026",
}));

import { api } from "@/lib/trpc";
import DashboardPage from "../page";

const mockDashboardQuery = api.dashboard.getData.useQuery as ReturnType<
  typeof vi.fn
>;

describe("DashboardPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: { user: { id: "u-1", credits: 15 } },
      status: "authenticated",
    });
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 3,
        calls: [
          {
            id: "c-1",
            status: "COMPLETED",
            durationSeconds: 120,
            createdAt: new Date(),
            scenario: { title: "Test Call" },
          },
        ],
        scenarios: [{ id: "s-1", title: "My Scenario" }],
      },
      isError: false,
    });
  });

  it("shows actual credits when loaded", () => {
    render(<DashboardPage />);

    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("shows recent calls list", () => {
    render(<DashboardPage />);

    const callElements = screen.getAllByText("Test Call");
    expect(callElements.length).toBeGreaterThanOrEqual(1);
    expect(callElements[0]).toBeInTheDocument();
  });

  it("shows replay link for completed calls", () => {
    render(<DashboardPage />);

    const replayLinks = screen.getAllByRole("link", { name: /replay/i });
    expect(replayLinks.length).toBeGreaterThan(0);
  });

  it("renders quick action cards", () => {
    render(<DashboardPage />);

    const nouvelAppel = screen.getAllByText(/nouvel appel/i);
    expect(nouvelAppel.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/bibliothèque/i)).toBeInTheDocument();
    const communaute = screen.getAllByText(/communauté/i);
    expect(communaute.length).toBeGreaterThanOrEqual(1);
  });

  // ── Loading state ────────────────────────────────────────────

  it("shows 0 credits while loading", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
    });

    render(<DashboardPage />);

    // Defaults to 0 when loading — use getAllByText since "0" may appear in other elements too
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  // ── Error state ──────────────────────────────────────────────

  it("shows 0 credits when query has error", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Error" },
    });

    render(<DashboardPage />);

    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute("data-title", "Dashboard");
  });

  // ── Empty calls state ────────────────────────────────────────

  it("shows empty calls state when no calls", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 0,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Pas encore d'appels")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Lance-toi ! Crée un scénario absurde et partage-le avec la communauté.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Créer mon premier scénario"),
    ).toBeInTheDocument();
  });

  // ── Empty scenarios ──────────────────────────────────────────

  it("shows create-first link when no scenarios created", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 0,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Créer mon premier →")).toBeInTheDocument();
  });

  it("hides create-first link when user has scenarios", () => {
    render(<DashboardPage />); // has scenarios: [{ id: "s-1", title: "My Scenario" }]

    expect(screen.queryByText("Créer mon premier →")).not.toBeInTheDocument();
  });

  // ── Today count ──────────────────────────────────────────────

  it("shows encouragement message when todayCount > 0", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 3,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("Bien joué !")).toBeInTheDocument();
  });

  it("shows different message when todayCount > 5", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 7,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByText("En pleine forme !")).toBeInTheDocument();
  });

  it("does not show encouragement when todayCount is 0", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 15,
        todayCount: 0,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.queryByText("Bien joué !")).not.toBeInTheDocument();
    expect(screen.queryByText("En pleine forme !")).not.toBeInTheDocument();
  });

  // ── Badges section ───────────────────────────────────────────

  it("renders BadgeGrid when session has user id", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u-1", credits: 15 } },
      status: "authenticated",
    });

    render(<DashboardPage />);

    expect(screen.getByTestId("badge-grid")).toHaveAttribute("data-user-id", "u-1");
  });

  it("shows login message when session has no user id", () => {
    mockUseSession.mockReturnValue({
      data: { user: null },
      status: "unauthenticated",
    });

    render(<DashboardPage />);

    expect(screen.getByText("Connectez-vous pour voir vos badges")).toBeInTheDocument();
    expect(screen.queryByTestId("badge-grid")).not.toBeInTheDocument();
  });
});
