import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReconsentMutate = vi.fn();
let mockConsentStatus: { isConsentWithdrawn: boolean } | undefined;
let mockIsLoading = false;

vi.mock("@/lib/trpc", () => ({
  api: {
    user: {
      getConsentStatus: {
        useQuery: () => ({
          data: mockConsentStatus,
          isLoading: mockIsLoading,
        }),
      },
      reconsent: {
        useMutation: () => ({
          mutate: mockReconsentMutate,
          isPending: false,
        }),
      },
    },
  },
}));

// Mock Alert components (they have lucide icons and style)
vi.mock("@echoroom/ui/alert", () => ({
  Alert: ({
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
    <div role="alert" data-variant={variant} className={className} {...props}>
      {children}
    </div>
  ),
  AlertTitle: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <h5 {...props}>{children}</h5>
  ),
  AlertDescription: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    [key: string]: unknown;
  }) => <div {...props}>{children}</div>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockConsentStatus = undefined;
  mockIsLoading = false;
  mockReconsentMutate.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConsentBanner", () => {
  let ConsentBanner: typeof import("../ConsentBanner").ConsentBanner;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../ConsentBanner");
    ConsentBanner = mod.ConsentBanner;
  });

  it("returns null when consent is active (isConsentWithdrawn is false)", () => {
    mockConsentStatus = { isConsentWithdrawn: false };

    const { container } = render(<ConsentBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when consent status is undefined (loading)", () => {
    mockConsentStatus = undefined;

    const { container } = render(<ConsentBanner />);

    expect(container.innerHTML).toBe("");
  });

  it("renders warning alert when consent is withdrawn", () => {
    mockConsentStatus = { isConsentWithdrawn: true };

    render(<ConsentBanner />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Consentement retiré")).toBeInTheDocument();
  });

  it("renders re-accept button when consent is withdrawn", () => {
    mockConsentStatus = { isConsentWithdrawn: true };

    render(<ConsentBanner />);

    const reacceptButton = screen.getByRole("button", { name: /ré-accepter/i });
    expect(reacceptButton).toBeInTheDocument();
    expect(reacceptButton).not.toBeDisabled();
  });

  it("calls reconsent mutation with consentAccepted: true on button click", async () => {
    const user = userEvent.setup();
    mockConsentStatus = { isConsentWithdrawn: true };

    render(<ConsentBanner />);

    const reacceptButton = screen.getByRole("button", { name: /ré-accepter/i });
    await user.click(reacceptButton);

    expect(mockReconsentMutate).toHaveBeenCalledWith({ consentAccepted: true });
  });

  it("renders the shield alert icon", () => {
    mockConsentStatus = { isConsentWithdrawn: true };

    const { container } = render(<ConsentBanner />);

    // ShieldAlert icon should be rendered as an SVG
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders the description text", () => {
    mockConsentStatus = { isConsentWithdrawn: true };

    render(<ConsentBanner />);

    expect(screen.getByText(/Vous avez retiré votre consentement/)).toBeInTheDocument();
  });

  it("has warning variant on the alert", () => {
    mockConsentStatus = { isConsentWithdrawn: true };

    render(<ConsentBanner />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("data-variant", "warning");
  });
});
