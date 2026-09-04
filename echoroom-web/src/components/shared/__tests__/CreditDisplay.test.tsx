import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseSession = vi.fn();

vi.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
}));

// Mock Tooltip to render its children and make content available for testing
vi.mock("@echoroom/ui/tooltip", () => ({
  Tooltip: ({
    children,
    content,
    side,
  }: {
    children: React.ReactNode;
    content: string;
    side?: string;
  }) => (
    <div data-testid="tooltip" data-content={content} data-side={side}>
      {children}
    </div>
  ),
}));

vi.mock("@echoroom/ui", () => ({
  Badge: ({
    children,
    variant,
    className,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
    [key: string]: unknown;
  }) => (
    <span className={className} data-variant={variant} {...props}>
      {children}
    </span>
  ),
  Skeleton: ({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <div className={className} data-testid="skeleton" {...props} />
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CreditDisplay", () => {
  let CreditDisplay: typeof import("../CreditDisplay").CreditDisplay;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../CreditDisplay");
    CreditDisplay = mod.CreditDisplay;
  });

  // ── Credits from prop ─────────────────────────────────────────────

  it("renders with explicit credits prop", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<CreditDisplay credits={10} />);

    expect(screen.getByText("10 crédits")).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).not.toBeInTheDocument();
  });

  // ── Credits from session ──────────────────────────────────────────

  it("renders credits from session when no prop", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { credits: 5 },
      },
      status: "authenticated",
    });

    render(<CreditDisplay />);

    expect(screen.getByText("5 crédits")).toBeInTheDocument();
  });

  // ── Skeleton when undefined ───────────────────────────────────────

  it("shows Skeleton when credits undefined and no session", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    render(<CreditDisplay />);

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("shows Skeleton when session has no credits", () => {
    mockUseSession.mockReturnValue({
      data: { user: {} },
      status: "authenticated",
    });

    render(<CreditDisplay />);

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ crédits/)).not.toBeInTheDocument();
  });

  // ── Zero credits ──────────────────────────────────────────────────

  it('displays "0 crédits" for zero credits', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<CreditDisplay credits={0} />);

    expect(screen.getByText("0 crédits")).toBeInTheDocument();
  });

  // ── Tooltip ───────────────────────────────────────────────────────

  it("renders tooltip with correct content", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<CreditDisplay credits={5} />);

    const tooltip = screen.getByTestId("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toHaveAttribute(
      "data-content",
      "Chaque appel consomme 1 crédit. 5 gratuits à l'inscription.",
    );
    expect(tooltip).toHaveAttribute("data-side", "bottom");
  });

  // ── Badge styling ─────────────────────────────────────────────────

  it("renders badge with secondary variant", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<CreditDisplay credits={3} />);

    const badge = screen.getByText("3 crédits");
    expect(badge).toHaveAttribute("data-variant", "secondary");
  });
});
