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

const mockMutate = vi.fn<(...args: any[]) => void>();
const mockRefetch = vi.fn();
const mockToast = vi.fn();

function createMutationObj() {
  const obj = {
    mutate: (...args: any[]) => {
      mockMutate(...args);
    },
    isPending: false,
    onSuccess: undefined as Function | undefined,
    onError: undefined as Function | undefined,
  };
  return obj;
}

const mockUseMutation = vi.fn(createMutationObj);
const mockUseQuery = vi.fn();

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
    let capturedOnSuccess: Function | undefined;
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
    let capturedOnError: Function | undefined;
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
    let capturedOnError: Function | undefined;
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
    let capturedOnError: Function | undefined;
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
});
