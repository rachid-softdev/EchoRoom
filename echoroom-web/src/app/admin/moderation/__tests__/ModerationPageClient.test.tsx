import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mutable mock variables
const mockApproveMutate = vi.hoisted(() => vi.fn());
const mockRejectMutate = vi.hoisted(() => vi.fn());
let mockApproveIsPending = vi.hoisted(() => false);
let mockRejectIsPending = vi.hoisted(() => false);

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    admin: {
      moderationQueue: {
        useQuery: vi.fn(),
      },
      approveScenario: {
        useMutation: vi.fn(() => ({
          mutate: mockApproveMutate,
          isPending: mockApproveIsPending,
        })),
      },
      rejectScenario: {
        useMutation: vi.fn(() => ({
          mutate: mockRejectMutate,
          isPending: mockRejectIsPending,
        })),
      },
    },
  },
}));

// Mock toast from UI
vi.mock("@/components/ui", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...(mod as any),
    toast: vi.fn(),
  };
});

// Mock lucide-react icons used by approve/reject buttons and DataLoader
vi.mock("lucide-react", () => ({
  Check: () => <svg data-testid="icon-check" />,
  X: () => <svg data-testid="icon-x" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

// Mock CommentModerationTab
vi.mock("@/components/admin/CommentModerationTab", () => ({
  CommentModerationTab: () => <div data-testid="comment-moderation-tab" />,
}));

import { api } from "@/lib/trpc";
import ModerationPageClient from "../ModerationPageClient";

// Clean up Radix portal elements that accumulate on document.body
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const mockQueueQuery = api.admin.moderationQueue.useQuery as ReturnType<typeof vi.fn>;

const mockScenarios = {
  items: [
    {
      id: "s-1",
      title: "Pending Scenario",
      character: { name: "Char" },
      creator: { username: "creator1" },
      createdAt: new Date("2024-01-15"),
      moderationStatus: "PENDING",
    },
  ],
  nextCursor: undefined,
};

describe("ModerationPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueueQuery.mockReturnValue({
      isLoading: false,
      data: mockScenarios,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("shows scenarios tab by default", () => {
    render(<ModerationPageClient />);

    expect(screen.getByText("Pending Scenario")).toBeInTheDocument();
  });

  it("has scenario and comment tab buttons", () => {
    render(<ModerationPageClient />);

    // Use getByRole to uniquely target the tab button (not the description text)
    expect(screen.getByRole("button", { name: /scénarios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /commentaires/i })).toBeInTheDocument();
  });

  it("shows approve and reject buttons for pending scenarios", () => {
    render(<ModerationPageClient />);

    // Approve button renders a Check icon (no visible text, no aria-label)
    const checkIcons = screen.getAllByTestId("icon-check");
    expect(checkIcons.length).toBeGreaterThan(0);
    const xIcons = screen.getAllByTestId("icon-x");
    expect(xIcons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no pending scenarios", () => {
    mockQueueQuery.mockReturnValue({
      isLoading: false,
      data: { items: [], nextCursor: undefined },
      isError: false,
      refetch: vi.fn(),
    });

    render(<ModerationPageClient />);

    expect(screen.getByText(/tout est modéré/i)).toBeInTheDocument();
  });

  // ── Loading state ────────────────────────────────────────────────────

  it("shows loading state while fetching the queue", () => {
    mockQueueQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      refetch: vi.fn(),
    });

    render(<ModerationPageClient />);

    // DataLoader renders a grid of skeletons when loading
    expect(screen.getByText(/Scénarios en attente de validation/)).toBeInTheDocument();
  });

  // ── Error state ──────────────────────────────────────────────────────

  it("shows error state when queue query fails", () => {
    mockQueueQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur réseau" },
      refetch: vi.fn(),
    });

    render(<ModerationPageClient />);

    // DataLoader renders "Une erreur est survenue" heading + error message
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Erreur réseau")).toBeInTheDocument();
  });

  it("shows generic error when queue query fails without message", () => {
    mockQueueQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<ModerationPageClient />);

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText(/Impossible de charger les données/)).toBeInTheDocument();
  });

  // ── Mutation calls ───────────────────────────────────────────────────

  it("calls approve mutation with scenarioId when approve button is clicked", () => {
    render(<ModerationPageClient />);

    const approveButton = screen.getAllByTestId("icon-check")[0]!.closest("button");
    expect(approveButton).not.toBeNull();
    fireEvent.click(approveButton!);

    expect(mockApproveMutate).toHaveBeenCalledWith({ scenarioId: "s-1" });
  });

  it("calls reject mutation with scenarioId when reject button is clicked", () => {
    render(<ModerationPageClient />);

    const rejectButton = screen.getAllByTestId("icon-x")[0]!.closest("button");
    expect(rejectButton).not.toBeNull();
    fireEvent.click(rejectButton!);

    expect(mockRejectMutate).toHaveBeenCalledWith({ scenarioId: "s-1" });
  });

  // ── Pending state ────────────────────────────────────────────────────

  it("disables approve button when approve mutation is pending", () => {
    mockApproveIsPending = true;

    render(<ModerationPageClient />);

    const approveButton = screen.getAllByTestId("icon-check")[0]!.closest("button");
    expect(approveButton).toBeDisabled();
  });

  it("disables reject button when reject mutation is pending", () => {
    mockRejectIsPending = true;

    render(<ModerationPageClient />);

    const rejectButton = screen.getAllByTestId("icon-x")[0]!.closest("button");
    expect(rejectButton).toBeDisabled();
  });

  // ── Tab switching ────────────────────────────────────────────────────

  it("switches to CommentModerationTab when Commentaires tab is clicked", () => {
    render(<ModerationPageClient />);

    expect(screen.queryByTestId("comment-moderation-tab")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /commentaires/i }));

    expect(screen.getByTestId("comment-moderation-tab")).toBeInTheDocument();
  });

  it("switches back to scenarios tab when Scénarios tab is clicked", () => {
    render(<ModerationPageClient />);

    // Switch to comments first
    fireEvent.click(screen.getByRole("button", { name: /commentaires/i }));
    expect(screen.getByTestId("comment-moderation-tab")).toBeInTheDocument();

    // Switch back to scenarios
    fireEvent.click(screen.getByRole("button", { name: /scénarios/i }));
    expect(screen.queryByTestId("comment-moderation-tab")).not.toBeInTheDocument();
  });
});
