import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
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
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

// Mock sub-components that call tRPC / use browser APIs
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/social/FeaturedScenario", () => ({
  FeaturedScenario: () => <div data-testid="featured-scenario" />,
}));

vi.mock("@/components/dashboard/TrendingFeed", () => ({
  TrendingFeed: () => <div data-testid="trending-feed" />,
}));

vi.mock("@/components/dashboard/OnboardingSequence", () => ({
  OnboardingSequence: ({ callsCount, scenariosCount }: any) => (
    <div
      data-testid="onboarding"
      data-calls={callsCount}
      data-scenarios={scenariosCount}
    />
  ),
}));

vi.mock("@/components/dashboard/SideWidgets", () => ({
  SideWidgets: ({ userId, recentCalls }: any) => (
    <div data-testid="side-widgets" data-user-id={userId}>
      {(recentCalls ?? []).map((c: any) => (
        <div key={c.id} data-testid="recent-call">
          <span>{c.scenario?.title}</span>
          {c.status === "COMPLETED" && <a href={`/call/${c.id}`}>replay</a>}
        </div>
      ))}
    </div>
  ),
}));

// Mock @/components/ui (Card, Badge, Button, Skeleton, etc.)
vi.mock("@echoroom/ui", () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
  Button: ({ children, onClick, variant, className, size, ...props }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className, ...props }: any) => (
    <p className={className} {...props}>
      {children}
    </p>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <h3 className={className} {...props}>
      {children}
    </h3>
  ),
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
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

const mockDashboardQuery = api.dashboard.getData.useQuery as ReturnType<typeof vi.fn>;

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

  it("renders the Chaos HQ dashboard shell", () => {
    render(<DashboardPage />);
    expect(screen.getByTestId("dashboard-shell")).toHaveAttribute(
      "data-title",
      "Chaos HQ",
    );
  });

  it("shows actual credits when loaded", () => {
    render(<DashboardPage />);
    // EnergyBar renders the credits count
    expect(screen.getByText(/15 crédits/)).toBeInTheDocument();
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

  it("renders dashboard widget sections", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("featured-scenario")).toBeInTheDocument();
    expect(screen.getByTestId("trending-feed")).toBeInTheDocument();
    expect(screen.getByTestId("side-widgets")).toBeInTheDocument();
  });

  // ── Loading state ────────────────────────────────────────────

  it("shows skeletons while loading", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThanOrEqual(1);
  });

  // ── Error state ──────────────────────────────────────────────

  it("shows error state when query fails", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur réseau" },
    });

    render(<DashboardPage />);

    expect(
      screen.getByText("Impossible de charger votre tableau de bord"),
    ).toBeInTheDocument();
    expect(screen.getByText("Erreur réseau")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /réessayer/i }),
    ).toBeInTheDocument();
  });

  // ── New user (onboarding) ──────────────────────────────────

  it("shows onboarding sequence for a brand-new user", () => {
    mockDashboardQuery.mockReturnValue({
      isLoading: false,
      data: {
        credits: 0,
        todayCount: 0,
        calls: [],
        scenarios: [],
      },
      isError: false,
    });

    render(<DashboardPage />);

    expect(screen.getByTestId("onboarding")).toBeInTheDocument();
  });

  it("hides onboarding when user has scenarios", () => {
    render(<DashboardPage />); // has scenarios: [{ id: "s-1", title: "My Scenario" }]

    expect(screen.queryByTestId("onboarding")).not.toBeInTheDocument();
    expect(screen.getByTestId("featured-scenario")).toBeInTheDocument();
  });

  // ── Today count (EnergyBar) ───────────────────────────────

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

  it("shows 'En feu !' message when todayCount > 5", () => {
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
    expect(screen.getByText("En feu !")).toBeInTheDocument();
  });

  it("shows 'Prêt à lancer ?' when todayCount is 0", () => {
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
    expect(screen.getByText("Prêt à lancer ?")).toBeInTheDocument();
    expect(screen.queryByText("Bien joué !")).not.toBeInTheDocument();
  });

  // ── Side widgets / badges ───────────────────────────────────

  it("renders side widgets with the session user id", () => {
    render(<DashboardPage />);

    expect(screen.getByTestId("side-widgets")).toHaveAttribute(
      "data-user-id",
      "u-1",
    );
  });

  it("renders side widgets without user id when unauthenticated", () => {
    mockUseSession.mockReturnValue({
      data: { user: null },
      status: "unauthenticated",
    });

    render(<DashboardPage />);

    expect(
      screen.getByTestId("side-widgets"),
    ).not.toHaveAttribute("data-user-id");
  });
});
