import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { BadgeDisplay } from "../BadgeDisplay";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockBadges = vi.hoisted(() => ({
  data: undefined as unknown[] | undefined | null,
  isLoading: false,
  isError: false,
}));

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      getUserBadges: {
        useQuery: () => mockBadges,
      },
    },
  },
}));

vi.mock("lucide-react", () => ({
  Medal: () => <span data-testid="mock-medal">Medal</span>,
  AlertCircle: () => <span data-testid="mock-alert-circle">AlertCircle</span>,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const badgeWithImage = {
  id: "ub-img",
  badge: {
    name: "Créatif",
    description: "A créé 10 scénarios",
    iconUrl: "https://example.com/icon.png",
  },
  awardedAt: "2024-03-20T00:00:00.000Z",
};

const badgeWithoutImage = {
  id: "ub-noimg",
  badge: {
    name: "Vétéran",
    description: "A participé à 100 appels",
    iconUrl: null,
  },
  awardedAt: "2024-01-15T00:00:00.000Z",
};

const mockBadgeData = [badgeWithImage, badgeWithoutImage];

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset state before each test
  mockBadges.data = undefined;
  mockBadges.isLoading = false;
  mockBadges.isError = false;
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BadgeDisplay", () => {
  it("shows 3 skeleton cards while loading", () => {
    mockBadges.isLoading = true;
    mockBadges.data = undefined;

    const { container } = render(<BadgeDisplay userId="user-1" />);

    // Should render skeleton elements with animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    // 3 skeleton containers × 3 skeleton lines each = 9 skeleton elements
    expect(skeletons.length).toBeGreaterThanOrEqual(9);
  });

  it("shows error message when query fails", () => {
    mockBadges.isError = true;
    mockBadges.data = undefined;

    render(<BadgeDisplay userId="user-1" />);

    expect(screen.getByText("Erreur lors du chargement des badges")).toBeInTheDocument();
  });

  it("shows error state with AlertCircle icon", () => {
    mockBadges.isError = true;

    render(<BadgeDisplay userId="user-1" />);

    expect(screen.getByTestId("mock-alert-circle")).toBeInTheDocument();
  });

  it("shows empty state when no badges returned", () => {
    mockBadges.data = [];

    render(<BadgeDisplay userId="user-1" />);

    expect(screen.getByText("Aucun badge pour le moment")).toBeInTheDocument();
    expect(
      screen.getByText("Participez à la communauté pour débloquer des badges !"),
    ).toBeInTheDocument();
  });

  it("shows Medal icon in empty state", () => {
    mockBadges.data = [];

    render(<BadgeDisplay userId="user-1" />);

    // The Medal icon is passed to EmptyState and rendered
    expect(screen.getByTestId("mock-medal")).toBeInTheDocument();
  });

  it("renders badges in a grid with name and description", () => {
    mockBadges.data = mockBadgeData;

    render(<BadgeDisplay userId="user-1" />);

    expect(screen.getByText("Créatif")).toBeInTheDocument();
    expect(screen.getByText("A créé 10 scénarios")).toBeInTheDocument();
    expect(screen.getByText("Vétéran")).toBeInTheDocument();
    expect(screen.getByText("A participé à 100 appels")).toBeInTheDocument();
  });

  it("renders img tag when badge has iconUrl", () => {
    mockBadges.data = mockBadgeData;

    const { container } = render(<BadgeDisplay userId="user-1" />);

    // img with alt="" has role="presentation", so use container.querySelector
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]).toHaveAttribute("src", "https://example.com/icon.png");
    expect(images[0]).toHaveAttribute("alt", "");
  });

  it("renders Medal fallback when badge has no iconUrl", () => {
    mockBadges.data = [badgeWithoutImage];

    render(<BadgeDisplay userId="user-1" />);

    // Should show the mock Medal component
    expect(screen.getByTestId("mock-medal")).toBeInTheDocument();
  });

  it("shows awarded date in French locale format", () => {
    mockBadges.data = [badgeWithoutImage];

    render(<BadgeDisplay userId="user-1" />);

    // "Obtenu le" prefix + French date format: "15 janvier 2024"
    expect(screen.getByText(/Obtenu le /)).toBeInTheDocument();
    expect(screen.getByText(/15 janvier 2024/)).toBeInTheDocument();
  });

  it("renders multiple badges correctly", () => {
    mockBadges.data = mockBadgeData;

    render(<BadgeDisplay userId="user-1" />);

    // Should have 2 Card elements (each badge renders in a Card)
    const cards = screen.getAllByText(/Créatif|Vétéran/);
    expect(cards).toHaveLength(2);
  });

  it("handles null data gracefully (falls back to empty array)", () => {
    mockBadges.data = null;

    render(<BadgeDisplay userId="user-1" />);

    // Should show empty state instead of crashing
    expect(screen.getByText("Aucun badge pour le moment")).toBeInTheDocument();
  });
});
