import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReactionBar } from "../ReactionBar";

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockRefetch = vi.fn();
const mockMutate = vi.fn();

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      getReactions: {
        useQuery: vi.fn(),
      },
      toggleLike: {
        useMutation: vi.fn(),
      },
    },
  },
}));

vi.mock("@echoroom/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@echoroom/ui")>();
  return {
    ...actual,
    toast: vi.fn(),
  };
});

// Simple EmojiPicker mock to avoid importing the real one
vi.mock("../EmojiPicker", () => ({
  EmojiPicker: ({
    onSelect,
    disabled,
  }: {
    onSelect: (emoji: string) => void;
    disabled?: boolean;
  }) => (
    <div data-testid="emoji-picker">
      <button
        type="button"
        onClick={() => onSelect("🔥")}
        disabled={disabled}
        data-testid="picker-emoji-fire"
      >
        🔥
      </button>
      <button
        type="button"
        onClick={() => onSelect("❤️")}
        disabled={disabled}
        data-testid="picker-emoji-heart"
      >
        ❤️
      </button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// Get the mocked modules
// ---------------------------------------------------------------------------

import { api } from "@/lib/trpc";

const mockUseQuery = api.social.getReactions.useQuery as ReturnType<typeof vi.fn>;
const mockUseMutation = api.social.toggleLike.useMutation as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockUseQuery.mockReturnValue({
    data: { reactions: [] },
    isLoading: false,
    refetch: mockRefetch,
  });

  mockUseMutation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  setupDefaultMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReactionBar", () => {
  const defaultProps = {
    scenarioId: "scenario-1",
  };

  // ── Renders existing reactions ────────────────────────────────────

  it("renders existing reaction buttons", () => {
    mockUseQuery.mockReturnValue({
      data: {
        reactions: [
          { emoji: "❤️", count: 5 },
          { emoji: "😂", count: 3 },
          { emoji: "🔥", count: 10 },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ReactionBar {...defaultProps} />);

    // Each reaction should be rendered
    expect(screen.getByText("❤️")).toBeInTheDocument();
    expect(screen.getByText("😂")).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();

    // Counts should be displayed
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders no reactions when reactions array is empty", () => {
    mockUseQuery.mockReturnValue({
      data: { reactions: [] },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ReactionBar {...defaultProps} />);

    // No reaction emojis should be rendered
    expect(screen.queryByText("❤️")).not.toBeInTheDocument();
    expect(screen.queryByText("😂")).not.toBeInTheDocument();

    // Only the "+" button should be present
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  it("renders no reactions when data is undefined", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ReactionBar {...defaultProps} />);

    // Should use empty array fallback, so no reactions rendered
    expect(screen.queryByText("❤️")).not.toBeInTheDocument();
    // "+" button should still be there
    expect(screen.getByText("+")).toBeInTheDocument();
  });

  // ── "+" button ────────────────────────────────────────────────────

  it('"+" button has aria-label "Ajouter une réaction"', () => {
    render(<ReactionBar {...defaultProps} />);

    // The button's accessible name comes from aria-label, not the visible text
    const addButton = screen.getByRole("button", {
      name: "Ajouter une réaction",
    });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveTextContent("+");
  });

  // ── Picker shows on click ─────────────────────────────────────────

  it("shows emoji picker when + button is clicked", async () => {
    const user = userEvent.setup();
    render(<ReactionBar {...defaultProps} />);

    // Picker should not be visible initially
    expect(screen.queryByTestId("emoji-picker")).not.toBeInTheDocument();

    // Click the "+" button
    const addButton = screen.getByText("+").closest("button")!;
    await user.click(addButton);

    // Picker should now be visible
    expect(screen.getByTestId("emoji-picker")).toBeInTheDocument();
  });

  it("hides emoji picker when + button is clicked again (toggle)", async () => {
    const user = userEvent.setup();
    render(<ReactionBar {...defaultProps} />);

    const addButton = screen.getByText("+").closest("button")!;

    // Open picker
    await user.click(addButton);
    expect(screen.getByTestId("emoji-picker")).toBeInTheDocument();

    // Close picker
    await user.click(addButton);
    expect(screen.queryByTestId("emoji-picker")).not.toBeInTheDocument();
  });

  // ── Toggle reaction ──────────────────────────────────────────────

  it("calls toggle mutation when an existing reaction is clicked", async () => {
    mockUseQuery.mockReturnValue({
      data: {
        reactions: [{ emoji: "❤️", count: 5 }],
      },
      isLoading: false,
      refetch: mockRefetch,
    });

    const user = userEvent.setup();
    render(<ReactionBar {...defaultProps} />);

    const heartButton = screen.getByText("❤️").closest("button")!;
    await user.click(heartButton);

    expect(mockMutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      emoji: "❤️",
    });
  });

  it("calls toggle mutation when an emoji is selected from the picker", async () => {
    const user = userEvent.setup();
    render(<ReactionBar {...defaultProps} />);

    // Open picker
    const addButton = screen.getByText("+").closest("button")!;
    await user.click(addButton);

    // Select the fire emoji from the picker
    const fireButton = screen.getByTestId("picker-emoji-fire");
    await user.click(fireButton);

    expect(mockMutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      emoji: "🔥",
    });
  });

  it("refetches reactions after successful toggle", () => {
    // The mutation is called with an onSuccess callback that refetches
    // We need to verify the mutation is set up with the right callbacks
    const onSuccessCallbacks: Array<() => void> = [];
    mockUseMutation.mockImplementation((opts: { onSuccess: () => void }) => {
      onSuccessCallbacks.push(opts.onSuccess);
      return {
        mutate: mockMutate,
        isPending: false,
      };
    });

    render(<ReactionBar {...defaultProps} />);

    // onSuccess callback should have been registered
    expect(onSuccessCallbacks.length).toBe(1);

    // Call the onSuccess callback
    onSuccessCallbacks[0]!();
    expect(mockRefetch).toHaveBeenCalled();
  });

  // ── Disabled state ───────────────────────────────────────────────

  it("disables buttons when mutation is pending", () => {
    mockUseMutation.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    mockUseQuery.mockReturnValue({
      data: {
        reactions: [{ emoji: "❤️", count: 5 }],
      },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ReactionBar {...defaultProps} />);

    const heartButton = screen.getByText("❤️").closest("button")!;
    expect(heartButton).toBeDisabled();

    const addButton = screen.getByText("+").closest("button")!;
    expect(addButton).toBeDisabled();
  });

  // ── Multiple reactions ───────────────────────────────────────────

  it("renders multiple reactions correctly", () => {
    mockUseQuery.mockReturnValue({
      data: {
        reactions: [
          { emoji: "❤️", count: 5 },
          { emoji: "😂", count: 3 },
          { emoji: "😮", count: 1 },
          { emoji: "🔥", count: 10 },
          { emoji: "😭", count: 7 },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });

    render(<ReactionBar {...defaultProps} />);

    expect(screen.getByText("❤️")).toBeInTheDocument();
    expect(screen.getByText("😂")).toBeInTheDocument();
    expect(screen.getByText("😮")).toBeInTheDocument();
    expect(screen.getByText("🔥")).toBeInTheDocument();
    expect(screen.getByText("😭")).toBeInTheDocument();

    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });
});
