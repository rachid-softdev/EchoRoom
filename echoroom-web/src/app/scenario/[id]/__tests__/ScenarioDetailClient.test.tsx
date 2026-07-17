import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock hooks
vi.mock("@/hooks", () => ({
  useUser: vi.fn(),
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    scenarios: {
      feed: {
        useQuery: vi.fn(),
      },
      getById: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock child social components
vi.mock("@/components/social/ReactionBar", () => ({
  ReactionBar: () => <div data-testid="reaction-bar" />,
}));

vi.mock("@/components/social/ShareButtons", () => ({
  ShareButtons: () => <div data-testid="share-buttons" />,
}));

vi.mock("@/components/social/ReportButton", () => ({
  ReportButton: () => <div data-testid="report-button" />,
}));

vi.mock("@/components/shared/ScenarioCard", () => ({
  ScenarioCard: ({ scenario }: any) => <div data-testid="scenario-card">{scenario.title}</div>,
}));

vi.mock("@/components/scenario/ClipCreator", () => ({
  ClipCreator: () => <div data-testid="clip-creator" />,
}));

vi.mock("@/components/scenario/CommentsSection", () => ({
  CommentsSection: () => <div data-testid="comments-section" />,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Heart: () => <svg data-testid="icon-heart" />,
  MessageCircle: () => <svg data-testid="icon-message-circle" />,
  Play: () => <svg data-testid="icon-play" />,
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

// Mock @/components/ui (Button, Badge, Avatar, Skeleton)
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, variant, className, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} {...props}>
      {children}
    </button>
  ),
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
  Avatar: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  AvatarImage: (props: any) => <img {...props} alt={props.alt ?? ""} />,
  AvatarFallback: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
}));

import { useUser } from "@/hooks";
import { api } from "@/lib/trpc";
import { ScenarioDetailClient } from "../ScenarioDetailClient";

const mockGetByIdQuery = api.scenarios.getById.useQuery as ReturnType<typeof vi.fn>;
const mockFeedQuery = api.scenarios.feed.useQuery as ReturnType<typeof vi.fn>;

const mockScenario = {
  id: "s-1",
  title: "Test Scenario",
  description: "A great scenario to test",
  category: "NPC",
  playCount: 1500,
  likeCount: 300,
  character: {
    name: "Robot",
    avatarUrl: "https://example.com/robot.png",
  },
  creator: { username: "creator1" },
  _count: { reactions: 42, comments: 7 },
};

describe("ScenarioDetailClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFeedQuery.mockReturnValue({
      isLoading: false,
      data: { items: [mockScenario], nextCursor: undefined },
      isError: false,
      refetch: vi.fn(),
    });
    mockGetByIdQuery.mockReturnValue({
      isLoading: false,
      data: mockScenario,
      isError: false,
      refetch: vi.fn(),
    });
  });

  // Clean up Radix portal elements
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("shows loading skeleton", () => {
    mockGetByIdQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      refetch: vi.fn(),
    });

    (useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    render(<ScenarioDetailClient scenarioId="s-1" />);

    // Loading state renders skeleton elements
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows not found state when scenario is null", () => {
    mockGetByIdQuery.mockReturnValue({
      isLoading: false,
      data: null,
      isError: false,
      refetch: vi.fn(),
    });

    (useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    render(<ScenarioDetailClient scenarioId="s-1" />);

    expect(screen.getByText(/scénario introuvable/i)).toBeInTheDocument();
  });

  it("handles authenticated user state", () => {
    (useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      user: { id: "u-1", username: "testuser", role: "USER" },
      isLoading: false,
      isAuthenticated: true,
    });

    render(<ScenarioDetailClient scenarioId="s-1" />);

    // Should show the scenario title
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("shows login button for unauthenticated users", () => {
    (useUser as ReturnType<typeof vi.fn>).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    render(<ScenarioDetailClient scenarioId="s-1" />);

    // Should show connect link for non-authenticated users
    expect(screen.getByText(/connectez-vous/i)).toBeInTheDocument();
  });
});
