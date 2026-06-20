import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// CommunityPageClient — comment mutation with callbacks (Sprint 2 Item 20)
// ---------------------------------------------------------------------------
// Tests the comment mutation contract:
//   - onSuccess: refetches feed, shows success toast
//   - onError: shows error toast (with message or fallback)
//   - isPending guard prevents double submissions
//   - Empty/whitespace content is prevented

const mockMutate = vi.hoisted(() => vi.fn<(...args: any[]) => void>());
const mockRefetch = vi.fn();
const mockToast = vi.hoisted(() => vi.fn());

function createMutationObj() {
  const obj = {
    mutate: (...args: any[]) => {
      mockMutate(...args);
    },
    isPending: false,
    onSuccess: undefined as ((...args: unknown[]) => unknown) | undefined,
    onError: undefined as ((...args: unknown[]) => unknown) | undefined,
  };
  return obj;
}

const mockUseMutation = vi.hoisted(() => vi.fn(createMutationObj));
const mockUseQuery = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  api: {
    scenarios: {
      feed: {
        useQuery: (...args: any[]) => (mockUseQuery as any)(...args),
      },
    },
    community: {
      comment: {
        useMutation: (...args: any[]) => (mockUseMutation as any)(...args),
      },
    },
  },
}));

vi.mock("@/components/ui", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  Badge: ({ children }: any) => <span>{children}</span>,
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} data-testid="send-button" {...props}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, onKeyDown, placeholder, ...props }: any) => (
    <input
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      data-testid="comment-input"
      {...props}
    />
  ),
  toast: mockToast,
}));

vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {children}
    </div>
  ),
}));

vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({ children, query, isEmpty, empty }: any) => {
    if (query.isLoading) return <div data-testid="loading">Loading...</div>;
    if (query.isError) return <div>Une erreur est survenue</div>;
    if (isEmpty(query.data)) return <div data-testid="empty">{empty}</div>;
    return <div data-testid="data-loaded">{children(query.data)}</div>;
  },
}));

vi.mock("@/components/shared/EmptyState", () => ({
  EmptyState: ({ title, description }: any) => (
    <div data-testid="empty-state">
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock("@/components/social/ReactionBar", () => ({
  ReactionBar: ({ scenarioId }: any) => (
    <div data-testid={`reaction-bar-${scenarioId}`}>Reactions</div>
  ),
}));

vi.mock("lucide-react", () => ({
  MessageCircle: () => <span data-testid="message-circle" />,
  Send: () => <span data-testid="send-icon" />,
  Users: () => <span data-testid="users-icon" />,
}));

vi.mock("@/lib/constants", () => ({
  CATEGORY_LABELS: { BOT: "Robot" },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

describe("CommunityPageClient — comment mutation (Item 20)", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default useMutation: fresh mutation with proper callbacks
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      const obj = createMutationObj();
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    // Default feed query mock
    mockUseQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "scenario-1",
            title: "Test Scenario",
            character: { slug: "bot" },
            creator: { username: "TestUser" },
            _count: { comments: 0 },
          },
        ],
      },
      isLoading: false,
      refetch: mockRefetch,
    });
  });

  it("should call comment mutation when send button is clicked with content", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Great scenario!");

    const sendButton = screen.getByTestId("send-button");
    fireEvent.click(sendButton);

    expect(mockMutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      content: "Great scenario!",
    });
  });

  it("should NOT call mutation when isPending is true (prevent double submit)", async () => {
    // Set isPending before render
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      const obj = createMutationObj();
      obj.isPending = true;
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Double submit test");

    const sendButton = screen.getByTestId("send-button");
    fireEvent.click(sendButton);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("should NOT call mutation when content is empty after trim", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "   "); // Only whitespace

    const sendButton = screen.getByTestId("send-button");
    fireEvent.click(sendButton);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("should show success toast and refetch feed on successful comment", async () => {
    let capturedOnSuccess: ((...args: unknown[]) => unknown) | undefined;
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      capturedOnSuccess = opts.onSuccess;
      const obj = createMutationObj();
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    // Type and submit
    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Nice post!");
    fireEvent.click(screen.getByTestId("send-button"));

    // Trigger the onSuccess callback
    if (capturedOnSuccess) capturedOnSuccess();

    expect(mockToast).toHaveBeenCalledWith({
      title: "Commentaire ajouté",
      variant: "default",
    });
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("should show error toast with error message on failed comment", async () => {
    let capturedOnError: ((...args: unknown[]) => unknown) | undefined;
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      capturedOnError = opts.onError;
      const obj = createMutationObj();
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "This will fail");
    fireEvent.click(screen.getByTestId("send-button"));

    if (capturedOnError) capturedOnError({ message: "Content rejected by moderation" });

    expect(mockToast).toHaveBeenCalledWith({
      title: "Content rejected by moderation",
      variant: "destructive",
    });
  });

  it("should show generic error toast when error has no message", async () => {
    let capturedOnError: ((...args: unknown[]) => unknown) | undefined;
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      capturedOnError = opts.onError;
      const obj = createMutationObj();
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Another comment");
    fireEvent.click(screen.getByTestId("send-button"));

    if (capturedOnError) capturedOnError({});

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur lors de l'ajout du commentaire",
      variant: "destructive",
    });
  });

  it("should submit on Enter key press", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Enter submission{enter}");

    expect(mockMutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      content: "Enter submission",
    });
  });

  it("should clear the mutation's side effect contract: input NOT cleared on error", async () => {
    // The component only clears input on success (via onSuccess), not on error.
    // Verify the structure: handleComment does NOT clear the input field.
    // This is a contract test — the input state management is in the component.
    let capturedOnError: ((...args: unknown[]) => unknown) | undefined;
    mockUseMutation.mockImplementation((...args: any[]) => {
      const opts = args[0];
      capturedOnError = opts.onError;
      const obj = createMutationObj();
      obj.onSuccess = opts.onSuccess;
      obj.onError = opts.onError;
      return obj;
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input") as HTMLInputElement;
    await userEvent.type(input, "Will fail");

    // Submit
    fireEvent.click(screen.getByTestId("send-button"));

    // Simulate error
    if (capturedOnError) capturedOnError({ message: "Error" });

    // Input should still have the text (not cleared on error)
    expect(input.value).toBe("Will fail");
  });

  // ── Feed loading state ───────────────────────────────────────

  it("shows loading state when feed is loading", async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: mockRefetch,
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    expect(screen.getByTestId("loading")).toBeInTheDocument();
  });

  // ── Feed error state ─────────────────────────────────────────

  it("shows DataLoader error state when feed query has error", async () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: { message: "Network error" },
      refetch: mockRefetch,
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    // DataLoader renders "Une erreur est survenue" in error state
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
  });

  // ── Empty feed state ─────────────────────────────────────────

  it("shows empty state when feed has no items", async () => {
    mockUseQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      refetch: mockRefetch,
    });

    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    expect(screen.getByText("Aucun post pour le moment")).toBeInTheDocument();
  });

  // ── Feed data renders correctly ─────────────────────────────

  it("renders scenario cards from feed data", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    expect(screen.getByText("Test Scenario")).toBeInTheDocument();
    expect(screen.getByText("TestUser")).toBeInTheDocument();
  });

  // ── Send button disabled when input empty ────────────────────

  it("send button is disabled when input is empty", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).toBeDisabled();
  });

  it("send button is enabled when input has text", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const input = screen.getByTestId("comment-input");
    await userEvent.type(input, "Some comment");

    const sendButton = screen.getByTestId("send-button");
    expect(sendButton).not.toBeDisabled();
  });

  // ── Comment count ────────────────────────────────────────────

  it("renders comment count from _count.comments", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    // Comment count for scenario-1 is 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  // ── ReactionBar rendering ────────────────────────────────────

  it("renders ReactionBar for each scenario", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    expect(screen.getByTestId("reaction-bar-scenario-1")).toBeInTheDocument();
  });

  // ── Scenario link ────────────────────────────────────────────

  it("renders scenario link to detail page", async () => {
    const Module = await import("../CommunityPageClient");
    render(<Module.default />);

    const scenarioLink = screen.getByRole("link", { name: /test scenario/i });
    expect(scenarioLink).toHaveAttribute("href", "/scenario/scenario-1");
  });
});
