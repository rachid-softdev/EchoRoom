import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock tRPC
const mockGetCommentsQuery = vi.hoisted(() => vi.fn());
const mockCommentMutation = vi.hoisted(() => vi.fn());
const mockModerateMutation = vi.hoisted(() => vi.fn());
const mockRefetch = vi.fn();

vi.mock("@/lib/trpc", () => ({
  api: {
    community: {
      getComments: {
        useQuery: (...args: unknown[]) => mockGetCommentsQuery(...args),
      },
      comment: {
        useMutation: (...args: unknown[]) => mockCommentMutation(...args),
      },
    },
    admin: {
      moderateComment: {
        useMutation: (...args: unknown[]) => mockModerateMutation(...args),
      },
    },
  },
}));

// Mock useUser hook
const mockUseUser = vi.hoisted(() => vi.fn());
vi.mock("@/hooks", () => ({
  useUser: () => mockUseUser(),
}));

// Mock next-auth
const mockUseSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock toast
const mockToast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/components/ui")>();
  return {
    ...original,
    toast: mockToast,
    Button: ({
      children,
      disabled,
      onClick,
      "aria-label": ariaLabel,
      className,
      ...props
    }: {
      children: React.ReactNode;
      disabled?: boolean;
      onClick?: () => void;
      "aria-label"?: string;
      className?: string;
      [key: string]: unknown;
    }) => (
      <button
        disabled={disabled}
        onClick={onClick}
        aria-label={ariaLabel}
        className={className}
        {...props}
      >
        {children}
      </button>
    ),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input {...props} />
    ),
    Avatar: ({ children, className }: { children: React.ReactNode; className?: string; [key: string]: unknown }) => (
      <div className={className}>{children}</div>
    ),
    AvatarImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img {...props} />
    ),
    AvatarFallback: ({
      children,
      className,
      ...props
    }: {
      children: React.ReactNode;
      className?: string;
      [key: string]: unknown;
    }) => <span className={className} {...props}>{children}</span>,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMocks() {
  mockUseUser.mockReturnValue({ isAuthenticated: false, user: null, isLoading: false });
  mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
  mockGetCommentsQuery.mockReturnValue({
    data: { items: [] },
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
  });
  mockCommentMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
  mockModerateMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommentsSection", () => {
  let CommentsSection: typeof import("../CommentsSection").CommentsSection;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupDefaultMocks();
    const mod = await import("../CommentsSection");
    CommentsSection = mod.CommentsSection;
  });

  // ── Auth state ────────────────────────────────────────────────────

  it("shows input for authenticated users", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(
      screen.getByPlaceholderText("Ajouter un commentaire..."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /envoyer/i }),
    ).toBeInTheDocument();
  });

  it("shows login link for unauthenticated users", () => {
    render(<CommentsSection scenarioId="scenario-1" />);

    const loginLink = screen.getByText("Connectez-vous pour commenter");
    expect(loginLink).toBeInTheDocument();
    expect(loginLink.closest("a")).toHaveAttribute(
      "href",
      "/login?redirect=/scenario/scenario-1",
    );
  });

  it("redirect URL includes scenario path", () => {
    render(<CommentsSection scenarioId="scenario-42" />);

    const loginLink = screen.getByText("Connectez-vous pour commenter");
    expect(loginLink.closest("a")).toHaveAttribute(
      "href",
      "/login?redirect=/scenario/scenario-42",
    );
  });

  // ── Comment count heading ─────────────────────────────────────────

  it("renders comment count in heading", () => {
    mockGetCommentsQuery.mockReturnValue({
      data: { items: [{ id: "1" }, { id: "2" }, { id: "3" }] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(screen.getByText("Commentaires (3)")).toBeInTheDocument();
  });

  // ── Empty state ───────────────────────────────────────────────────

  it("shows empty state when no comments", () => {
    render(<CommentsSection scenarioId="scenario-1" />);

    expect(
      screen.getByText("Aucun commentaire pour le moment. Soyez le premier !"),
    ).toBeInTheDocument();
  });

  // ── Comment rendering ─────────────────────────────────────────────

  it("renders comment with user avatar, name, content, date", () => {
    const mockDate = "2024-01-15T10:30:00Z";
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Super scénario !",
            createdAt: mockDate,
            user: {
              username: "Jean",
              image: "https://example.com/avatar.jpg",
            },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(screen.getByText("Super scénario !")).toBeInTheDocument();
    expect(screen.getByText("Jean")).toBeInTheDocument();
    // Avatar image should have the correct src
    const avatarImg = screen.getByAltText("Jean");
    expect(avatarImg).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it('shows "Anonyme" when no username', () => {
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Bonjour",
            createdAt: "2024-01-15T10:30:00Z",
            user: null,
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(screen.getByText("Anonyme")).toBeInTheDocument();
  });

  // ── Sending comments ──────────────────────────────────────────────

  it("sends comment when Enter is pressed (without Shift)", async () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    const mutate = vi.fn();
    mockCommentMutation.mockReturnValue({
      mutate,
      isPending: false,
    });

    const user = userEvent.setup();
    render(<CommentsSection scenarioId="scenario-1" />);

    const input = screen.getByPlaceholderText("Ajouter un commentaire...");
    await user.type(input, "Mon commentaire{Enter}");

    expect(mutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      content: "Mon commentaire",
    });
  });

  it("does NOT send on Shift+Enter", async () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    const mutate = vi.fn();
    mockCommentMutation.mockReturnValue({
      mutate,
      isPending: false,
    });

    const user = userEvent.setup();
    render(<CommentsSection scenarioId="scenario-1" />);

    const input = screen.getByPlaceholderText("Ajouter un commentaire...");
    await user.type(input, "Mon commentaire");
    await user.keyboard("{Shift>}{Enter}{/Shift}");

    expect(mutate).not.toHaveBeenCalled();
  });

  it("button disabled when input is empty", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    expect(sendButton).toBeDisabled();
  });

  it("button disabled when input is only whitespace", async () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    const user = userEvent.setup();
    render(<CommentsSection scenarioId="scenario-1" />);

    const input = screen.getByPlaceholderText("Ajouter un commentaire...");
    await user.type(input, "   ");

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    expect(sendButton).toBeDisabled();
  });

  it("button disabled during mutation", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    mockCommentMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    expect(sendButton).toBeDisabled();
  });

  it("sends comment via button click", async () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Test" },
      isLoading: false,
    });

    const mutate = vi.fn();
    mockCommentMutation.mockReturnValue({
      mutate,
      isPending: false,
    });

    const user = userEvent.setup();
    render(<CommentsSection scenarioId="scenario-1" />);

    const input = screen.getByPlaceholderText("Ajouter un commentaire...");
    await user.type(input, "Mon message");

    const sendButton = screen.getByRole("button", { name: /envoyer/i });
    await user.click(sendButton);

    expect(mutate).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      content: "Mon message",
    });
  });

  // ── Admin moderation ──────────────────────────────────────────────

  it("admin sees moderate button", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Admin" },
      isLoading: false,
    });
    mockUseSession.mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
    });
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Bad comment",
            createdAt: "2024-01-15T10:30:00Z",
            user: { username: "User" },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(
      screen.getByRole("button", { name: /modérer/i }),
    ).toBeInTheDocument();
  });

  it("non-admin does NOT see moderate button", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "User", role: "USER" },
      isLoading: false,
    });
    mockUseSession.mockReturnValue({
      data: { user: { role: "USER" } },
      status: "authenticated",
    });
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Comment",
            createdAt: "2024-01-15T10:30:00Z",
            user: { username: "User" },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    expect(
      screen.queryByRole("button", { name: /modérer/i }),
    ).not.toBeInTheDocument();
  });

  it("moderate button disabled during mutation", () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Admin" },
      isLoading: false,
    });
    mockUseSession.mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
    });
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Bad comment",
            createdAt: "2024-01-15T10:30:00Z",
            user: { username: "User" },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    mockModerateMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    });

    render(<CommentsSection scenarioId="scenario-1" />);

    const moderateBtn = screen.getByRole("button", { name: /modérer/i });
    expect(moderateBtn).toBeDisabled();
  });

  it("ConfirmDialog opens on moderate click", async () => {
    mockUseUser.mockReturnValue({
      isAuthenticated: true,
      user: { id: "1", name: "Admin" },
      isLoading: false,
    });
    mockUseSession.mockReturnValue({
      data: { user: { role: "ADMIN" } },
      status: "authenticated",
    });
    mockGetCommentsQuery.mockReturnValue({
      data: {
        items: [
          {
            id: "c1",
            content: "Bad comment",
            createdAt: "2024-01-15T10:30:00Z",
            user: { username: "User" },
          },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
    });

    const user = userEvent.setup();
    render(<CommentsSection scenarioId="scenario-1" />);

    const moderateBtn = screen.getByRole("button", { name: /modérer/i });
    await user.click(moderateBtn);

    // ConfirmDialog should appear
    expect(
      screen.getByText("Modérer le commentaire"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cette action supprimera le commentaire. Voulez-vous continuer ?",
      ),
    ).toBeInTheDocument();
  });
});
