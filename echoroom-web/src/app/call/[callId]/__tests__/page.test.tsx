import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// CallReplayPage tests — Client Component with tRPC + DataLoader
// ---------------------------------------------------------------------------
// The page:
//   - Uses useParams() to get callId
//   - Fetches replay data via api.calls.replay.useQuery
//   - Fetches history via api.calls.history.useQuery
//   - Renders DashboardShell with call info header when matching call found
//   - Uses DataLoader to handle replayQuery states (loading/error/empty/data)
//   - Renders AudioPlayer and TranscriptView inside DataLoader

// Mock next/navigation
const mockUseParams = vi.fn();
vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
}));

// Mock tRPC
const mockReplayQuery = vi.fn();
const mockHistoryQuery = vi.fn();
vi.mock("@/lib/trpc", () => ({
  api: {
    calls: {
      replay: {
        useQuery: mockReplayQuery,
      },
      history: {
        useQuery: mockHistoryQuery,
      },
    },
  },
}));

// Mock DashboardShell
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({
    children,
    title,
    backHref,
  }: {
    children: React.ReactNode;
    title: string;
    backHref?: string;
  }) => (
    <div data-testid="dashboard-shell" data-title={title} data-back-href={backHref}>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

// Mock DataLoader — renders children when data is available, else shows loading/error/empty
vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({
    query,
    children,
    empty,
    isEmpty,
  }: {
    query: { data: any; isLoading: boolean; isError: boolean; error?: any; refetch: any };
    children: (data: any) => React.ReactNode;
    empty?: React.ReactNode;
    isEmpty?: (data: any) => boolean;
  }) => {
    if (query.isLoading) {
      return <div data-testid="dataloader-loading">Chargement en cours...</div>;
    }
    if (query.isError) {
      return (
        <div data-testid="dataloader-error">
          <p>Une erreur est survenue</p>
          <p>{query.error?.message ?? "Impossible de charger les données. Réessayez."}</p>
          <button type="button" onClick={() => query.refetch()}>Réessayer</button>
        </div>
      );
    }
    if (!query.data || isEmpty?.(query.data)) {
      return <div data-testid="dataloader-empty">{empty ?? "Aucun résultat"}</div>;
    }
    return <div data-testid="dataloader-content">{children(query.data)}</div>;
  },
}));

// Mock player components
vi.mock("@/components/player/ReplayHeader", () => ({
  ReplayHeader: (props: any) => <div data-testid="replay-header" {...props} />,
}));

vi.mock("@/components/player/AudioPlayer", () => ({
  AudioPlayer: (props: any) => (
    <div data-testid="audio-player" data-recording-url={props.recordingUrl}>
      {props.title && <span data-testid="audio-player-title">{props.title}</span>}
    </div>
  ),
}));

vi.mock("@/components/player/TranscriptView", () => ({
  TranscriptView: (props: any) => (
    <div
      data-testid="transcript-view"
      data-is-loading={props.isLoading}
      data-scenario-name={props.scenarioName}
    />
  ),
}));

// Mock lucide-react icons used by DataLoader and DashboardShell
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
  Settings: () => <svg data-testid="icon-settings" />,
  LayoutDashboard: () => <svg data-testid="icon-layout-dashboard" />,
  PlusCircle: () => <svg data-testid="icon-plus-circle" />,
  Library: () => <svg data-testid="icon-library" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Users: () => <svg data-testid="icon-users" />,
  Trophy: () => <svg data-testid="icon-trophy" />,
  CreditCard: () => <svg data-testid="icon-credit-card" />,
  Phone: () => <svg data-testid="icon-phone" />,
}));

// Mock @/components/ui
vi.mock("@echoroom/ui", () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
  Button: ({ children, onClick, variant, className, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} {...props}>
      {children}
    </button>
  ),
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

// Mock CreditDisplay (used in DashboardShell)
vi.mock("@/components/shared/CreditDisplay", () => ({
  CreditDisplay: () => <span data-testid="credit-display" />,
}));

// Mock ThemeToggle (used in DashboardShell)
vi.mock("@echoroom/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button type="button" data-testid="theme-toggle">Theme</button>,
}));

// Mock Breadcrumbs (used in DashboardShell)
vi.mock("@/components/shared/Breadcrumbs", () => ({
  Breadcrumbs: () => <nav data-testid="breadcrumbs" />,
}));

// Mock next/link (used in DashboardShell)
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

function setupDefaultMocks() {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ callId: "call-1" });
}

describe("CallReplayPage", () => {
  // -----------------------------------------------------------------------
  // Loading State
  // -----------------------------------------------------------------------

  it("shows loading state when replay query is loading", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByText("Replay de l'appel")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Error State
  // -----------------------------------------------------------------------

  it("shows error state when replay query fails", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      isFetching: false,
      error: { message: "Échec du chargement du replay" },
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByText("Échec du chargement du replay")).toBeInTheDocument();
    expect(screen.getByText(/Réessayer/i)).toBeInTheDocument();
  });

  it("shows generic error message when no specific error is provided", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByText("Impossible de charger les données. Réessayez.")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Success State — with matching call in history
  // -----------------------------------------------------------------------

  it("renders AudioPlayer and TranscriptView when replay data is available", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: [
          { speaker: "AI", text: "Bonjour !" },
          { speaker: "User", text: "Salut !" },
        ],
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "COMPLETED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
    expect(screen.getByTestId("audio-player")).toHaveAttribute(
      "data-recording-url",
      "https://example.com/recording.mp3",
    );
    expect(screen.getByTestId("transcript-view")).toBeInTheDocument();
  });

  it("renders call info header when matching call is found in history", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: null,
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "COMPLETED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    // Should show scenario title (appears in header info and in AudioPlayer)
    const testCallElements = screen.getAllByText("Test Call");
    expect(testCallElements.length).toBeGreaterThanOrEqual(1);
    // Should show "Terminé" badge for COMPLETED status
    expect(screen.getByText("Terminé")).toBeInTheDocument();
  });

  it("renders ReplayHeader with matching call data", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: null,
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "COMPLETED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByTestId("replay-header")).toBeInTheDocument();
  });

  it("passes scenario title to AudioPlayer", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: null,
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "COMPLETED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByTestId("audio-player-title")).toHaveTextContent("Test Call");
  });

  it("passes scenario title to TranscriptView as scenarioName", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: [{ speaker: "AI", text: "Hello" }],
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "COMPLETED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByTestId("transcript-view")).toHaveAttribute(
      "data-scenario-name",
      "Test Call",
    );
  });

  // -----------------------------------------------------------------------
  // Success State — without matching call (not in history)
  // -----------------------------------------------------------------------

  it("does not render call info header when call is not in history", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: null,
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [{ id: "other-call", scenario: { title: "Other" } }],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    // "Test Call" should not be rendered since the matching call is not in history
    expect(screen.queryByText("Test Call")).not.toBeInTheDocument();
    // ReplayHeader should not be rendered
    expect(screen.queryByTestId("replay-header")).not.toBeInTheDocument();
    // But DataLoader content should still render
    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
  });

  it("does not render call info when history items are empty", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: {
        recordingUrl: "https://example.com/recording.mp3",
        transcript: null,
      },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.queryByText("Test Call")).not.toBeInTheDocument();
    expect(screen.queryByTestId("replay-header")).not.toBeInTheDocument();
    expect(screen.getByTestId("audio-player")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // DashboardShell Props
  // -----------------------------------------------------------------------

  it("renders DashboardShell with correct title and backHref", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: { recordingUrl: "https://example.com/recording.mp3", transcript: null },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    const shell = screen.getByTestId("dashboard-shell");
    expect(shell).toHaveAttribute("data-title", "Replay de l'appel");
    expect(shell).toHaveAttribute("data-back-href", "/history");
  });

  // -----------------------------------------------------------------------
  // Status badge text mapping
  // -----------------------------------------------------------------------

  it("displays status as-is for non-COMPLETED statuses", async () => {
    setupDefaultMocks();
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: { recordingUrl: "https://example.com/recording.mp3", transcript: null },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: {
        items: [
          {
            id: "call-1",
            scenario: { title: "Test Call", character: { name: "Robot" } },
            durationSeconds: 120,
            status: "INTERRUPTED",
          },
        ],
      },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    expect(screen.getByText("INTERRUPTED")).toBeInTheDocument();
    expect(screen.queryByText("Terminé")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // useParams call verification
  // -----------------------------------------------------------------------

  it("reads callId from useParams and passes it to tRPC queries", async () => {
    setupDefaultMocks();
    mockUseParams.mockReturnValue({ callId: "specific-call-id" });
    mockReplayQuery.mockReturnValue({
      isLoading: false,
      data: { recordingUrl: "https://example.com/recording.mp3", transcript: null },
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    mockHistoryQuery.mockReturnValue({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    });

    const mod = await import("../page");
    render(<mod.default />);

    // Verify tRPC queries received the correct callId
    expect(mockReplayQuery).toHaveBeenCalledWith({ callId: "specific-call-id" });
    expect(mockHistoryQuery).toHaveBeenCalledWith({ limit: 1 });
  });
});
