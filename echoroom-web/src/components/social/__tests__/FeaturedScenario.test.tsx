import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeaturedScenario } from "../FeaturedScenario";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      getFeatured: {
        useQuery: vi.fn(),
      },
    },
  },
}));

import { api } from "@/lib/trpc";

const mockQuery = api.social.getFeatured.useQuery as ReturnType<typeof vi.fn>;

const mockScenario = {
  id: "s-1",
  title: "Test Scenario",
  description: "A great scenario",
  playCount: 1500,
  likeCount: 300,
  character: { name: "Char", image: "https://example.com/avatar.png" },
  creator: { username: "creator1" },
  _count: { reactions: 42, comments: 7 },
};

describe("FeaturedScenario", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading skeleton", () => {
    mockQuery.mockReturnValue({ isLoading: true, data: undefined, isError: false });

    const { container } = render(<FeaturedScenario />);

    // Should render skeleton elements
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("returns null when no featured scenario", () => {
    mockQuery.mockReturnValue({ isLoading: false, data: null, isError: false });

    const { container } = render(<FeaturedScenario />);

    expect(container.innerHTML).toBe("");
  });

  it("renders scenario with character, creator and stats", () => {
    mockQuery.mockReturnValue({ isLoading: false, data: mockScenario, isError: false });

    render(<FeaturedScenario />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(screen.getByText("A great scenario")).toBeInTheDocument();
    expect(screen.getByText(/Scénario du jour/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Démarrer/i })).toHaveAttribute(
      "href",
      "/create?scenario=s-1",
    );
  });

  it("renders without character info", () => {
    const noChar = { ...mockScenario, character: undefined };
    mockQuery.mockReturnValue({ isLoading: false, data: noChar, isError: false });

    render(<FeaturedScenario />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("renders without creator info", () => {
    const noCreator = { ...mockScenario, creator: undefined };
    mockQuery.mockReturnValue({ isLoading: false, data: noCreator, isError: false });

    render(<FeaturedScenario />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });

  it("playCount defaults gracefully when undefined", () => {
    const noPlayCount = { ...mockScenario, playCount: undefined };
    mockQuery.mockReturnValue({
      isLoading: false,
      data: noPlayCount,
      isError: false,
    });

    render(<FeaturedScenario />);

    // Should render without crashing, showing 0 or hiding play count
    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
  });
});
