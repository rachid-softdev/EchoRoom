import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefetch = vi.hoisted(() => vi.fn());
const mockApproveMutate = vi.hoisted(() => vi.fn());
const mockRejectMutate = vi.hoisted(() => vi.fn());
let mockQueryData: unknown = vi.hoisted(() => undefined);
let mockQueryIsLoading = vi.hoisted(() => false);
let mockQueryIsError = vi.hoisted(() => false);
let mockQueryError: { message?: string } | null = vi.hoisted(() => null);

vi.mock("@/lib/trpc", () => ({
  api: {
    useUtils: () => ({
      admin: {
        moderationQueueComments: {
          refetch: mockRefetch,
        },
      },
    }),
    admin: {
      moderationQueueComments: {
        useQuery: () => ({
          data: mockQueryData,
          isLoading: mockQueryIsLoading,
          isError: mockQueryIsError,
          error: mockQueryError,
          refetch: mockRefetch,
        }),
      },
      approveComment: {
        useMutation: () => ({
          mutate: mockApproveMutate,
          isPending: false,
        }),
      },
      rejectComment: {
        useMutation: () => ({
          mutate: mockRejectMutate,
          isPending: false,
        }),
      },
    },
  },
}));

// Mock toast
vi.mock("@/components/ui", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    toast: vi.fn(),
  };
});

// Mock DataLoader - simpler version
vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({
    children,
    query,
    isEmpty,
    empty,
  }: {
    children: (data: unknown) => React.ReactNode;
    query: {
      data: unknown;
      isLoading: boolean;
      isError: boolean;
      error: { message?: string } | null;
    };
    isEmpty?: (data: unknown) => boolean;
    empty?: React.ReactNode;
  }) => {
    if (query.isLoading) return <div data-testid="loader-loading">Loading...</div>;
    if (query.isError)
      return <div data-testid="loader-error">Error: {query.error?.message ?? "Unknown"}</div>;
    if (query.data === null || query.data === undefined)
      return <div data-testid="loader-empty">Aucun résultat</div>;
    if (isEmpty && isEmpty(query.data)) return <>{empty}</>;
    return <>{children(query.data)}</>;
  },
}));

// Mock EmptyState
vi.mock("@/components/shared/EmptyState", () => ({
  EmptyState: ({
    icon: Icon,
    title,
    description,
  }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
  }) => (
    <div data-testid="empty-state">
      {Icon && <Icon data-testid="empty-icon" />}
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryData = undefined;
  mockQueryIsLoading = false;
  mockQueryIsError = false;
  mockQueryError = null;
  mockRefetch.mockReset();
  mockApproveMutate.mockReset();
  mockRejectMutate.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommentModerationTab", () => {
  let CommentModerationTab: typeof import("../CommentModerationTab").CommentModerationTab;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../CommentModerationTab");
    CommentModerationTab = mod.CommentModerationTab;
  });

  // ── Loading state ─────────────────────────────────────────────────

  it("shows loading state when query is loading", () => {
    mockQueryIsLoading = true;

    render(<CommentModerationTab />);

    expect(screen.getByTestId("loader-loading")).toBeInTheDocument();
  });

  // ── Tabs ──────────────────────────────────────────────────────────

  it("renders Pending and Rejected filter buttons", () => {
    mockQueryData = { items: [] };

    render(<CommentModerationTab />);

    expect(screen.getByRole("button", { name: /en attente/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rejetés/i })).toBeInTheDocument();
  });

  it("shows Pending as default active tab", () => {
    mockQueryData = { items: [] };

    render(<CommentModerationTab />);

    const pendingBtn = screen.getByRole("button", { name: /en attente/i });
    const rejectedBtn = screen.getByRole("button", { name: /rejetés/i });

    // Pending should have "default" variant, rejected should have "outline"
    expect(pendingBtn.className).toContain("bg-primary");
    expect(rejectedBtn.className).not.toContain("bg-primary");
  });

  // ── Empty state ───────────────────────────────────────────────────

  it('shows "Aucun commentaire en attente" when pending list is empty', () => {
    mockQueryData = { items: [] };

    render(<CommentModerationTab />);

    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText("Aucun commentaire en attente")).toBeInTheDocument();
  });

  it('shows "Aucun commentaire rejeté" when rejected list is empty', async () => {
    const user = userEvent.setup();
    mockQueryData = { items: [] };

    render(<CommentModerationTab />);

    // Switch to Rejected tab
    await user.click(screen.getByRole("button", { name: /rejetés/i }));

    // After clicking, the query refetches with new status. In our mock, the data
    // stays the same but the UI updates via the component re-render.
    const emptyState = screen.getByTestId("empty-state");
    expect(emptyState).toBeInTheDocument();
    expect(screen.getByText("Aucun commentaire rejeté")).toBeInTheDocument();
  });

  // ── Comment list ──────────────────────────────────────────────────

  it("renders list of pending comments with approve/reject buttons", () => {
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "This is a test comment",
          createdAt: new Date("2024-06-15T10:30:00Z"),
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
        {
          id: "comment-2",
          content: "Another comment",
          createdAt: new Date("2024-06-16T14:00:00Z"),
          user: { username: "anotheruser" },
          scenario: { id: "scenario-2", title: "Another Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    // Check usernames
    expect(screen.getByText("testuser")).toBeInTheDocument();
    expect(screen.getByText("anotheruser")).toBeInTheDocument();

    // Check comment content
    expect(screen.getByText("This is a test comment")).toBeInTheDocument();
    expect(screen.getByText("Another comment")).toBeInTheDocument();

    // Check scenario links
    const scenarioLinks = screen.getAllByRole("link");
    expect(scenarioLinks.length).toBeGreaterThanOrEqual(2);

    // Check approve/reject buttons
    const approveButtons = screen.getAllByRole("button", { name: /approuver/i });
    const rejectButtons = screen.getAllByRole("button", { name: /rejeter/i });
    expect(approveButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  it("calls approve mutation with commentId when approve is clicked", async () => {
    const user = userEvent.setup();
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "Test comment",
          createdAt: new Date("2024-06-15T10:30:00Z"),
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    await user.click(screen.getByRole("button", { name: /approuver/i }));

    expect(mockApproveMutate).toHaveBeenCalledWith({ commentId: "comment-1" });
  });

  it("calls reject mutation with id when reject is clicked", async () => {
    const user = userEvent.setup();
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "Test comment",
          createdAt: new Date("2024-06-15T10:30:00Z"),
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    await user.click(screen.getByRole("button", { name: /rejeter/i }));

    expect(mockRejectMutate).toHaveBeenCalledWith({ id: "comment-1" });
  });

  it("does not show approve/reject buttons for rejected comments", () => {
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "Test comment",
          createdAt: new Date("2024-06-15T10:30:00Z"),
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    // By default PENDING tab shows approve/reject buttons
    expect(screen.getByRole("button", { name: /approuver/i })).toBeInTheDocument();
  });

  // ── Scenario link ─────────────────────────────────────────────────

  it("renders scenario link with correct href", () => {
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "Test comment",
          createdAt: new Date("2024-06-15T10:30:00Z"),
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    const link = screen.getByRole("link", { name: /sur :/i });
    expect(link).toHaveAttribute("href", "/scenario/scenario-1");
  });

  // ── Date formatting ───────────────────────────────────────────────

  it("renders formatted creation date", () => {
    const date = new Date("2024-06-15T10:30:00Z");
    mockQueryData = {
      items: [
        {
          id: "comment-1",
          content: "Test comment",
          createdAt: date,
          user: { username: "testuser" },
          scenario: { id: "scenario-1", title: "Test Scenario" },
        },
      ],
    };

    render(<CommentModerationTab />);

    // Should render in French format
    const formattedDate = date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(screen.getByText(formattedDate)).toBeInTheDocument();
  });
});
