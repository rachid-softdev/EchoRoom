import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: "u-1", credits: 42 } },
    status: "authenticated",
  })),
}));

const mockCheckoutMutate = vi.fn();

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    billing: {
      getCredits: {
        useQuery: vi.fn(),
      },
      getPurchases: {
        useQuery: vi.fn(),
      },
      createCheckout: {
        useMutation: vi.fn(() => ({
          mutate: (...args: unknown[]) => mockCheckoutMutate(...args),
          isPending: false,
          data: null,
        })),
      },
    },
  },
}));

// Mock trpc-error (useApiToast wrapper)
vi.mock("@/lib/trpc-error", () => ({
  useApiToast: vi.fn((mutation, opts) => ({
    ...mutation,
    mutate: (...args: unknown[]) => {
      mockCheckoutMutate(...args);
      opts?.onSuccess?.({ url: "https://checkout.stripe.com/test" });
    },
    isPending: mutation.isPending,
  })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock DashboardShell
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title }: { children: React.ReactNode; title: string }) =>
    <div data-testid="dashboard-shell" data-title={title}>{children}</div>,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  CreditCard: () => <svg data-testid="icon-credit-card" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>{children}</span>
  ),
  Button: ({ children, onClick, variant, className, disabled, size, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} data-size={size} className={className} disabled={disabled} {...props}>{children}</button>
  ),
  Card: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardDescription: ({ children, className, ...props }: any) => <p className={className} {...props}>{children}</p>,
  CardHeader: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardTitle: ({ children, className, ...props }: any) => <h2 className={className} {...props}>{children}</h2>,
}));

import { api } from "@/lib/trpc";
import BillingPage from "../page";

const mockCreditsQuery = api.billing.getCredits.useQuery as ReturnType<
  typeof vi.fn
>;
const mockPurchasesQuery = api.billing.getPurchases.useQuery as ReturnType<
  typeof vi.fn
>;

describe("BillingPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreditsQuery.mockReturnValue({
      isLoading: false,
      data: { credits: 42 },
      isError: false,
    });
    mockPurchasesQuery.mockReturnValue({
      isLoading: false,
      data: [],
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("displays current credits balance", () => {
    render(<BillingPage />);

    // The text "42 crédits" is rendered inside Badge
    expect(screen.getByText(/42 crédits/)).toBeInTheDocument();
  });

  it("shows 0 when data not loaded", () => {
    mockCreditsQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
    });

    render(<BillingPage />);

    // When data is undefined, credits defaults to 0
    expect(screen.getByText(/0 crédit/)).toBeInTheDocument();
  });

  it("renders credit packs with correct prices", () => {
    render(<BillingPage />);

    // Credit pack card titles show the number of credits
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();

    // Prices should be rendered
    expect(screen.getByText("2,99 €")).toBeInTheDocument();
    expect(screen.getByText("9,99 €")).toBeInTheDocument();
    expect(screen.getByText("24,99 €")).toBeInTheDocument();
    expect(screen.getByText("49,99 €")).toBeInTheDocument();
  });

  // ── Popular badge ────────────────────────────────────────────

  it("shows popular badge on the 50 credits pack", () => {
    render(<BillingPage />);

    const popularBadges = screen.getAllByText("Populaire");
    expect(popularBadges.length).toBeGreaterThanOrEqual(1);
  });

  // ── Purchase flow ────────────────────────────────────────────

  it("calls checkout mutation with correct priceId when buy button is clicked", () => {
    render(<BillingPage />);

    // Click "Acheter" on the first pack (10 credits)
    const buyButtons = screen.getAllByText("Acheter");
    fireEvent.click(buyButtons[0]!);

    expect(mockCheckoutMutate).toHaveBeenCalledWith({
      priceId: "price_10",
      credits: 10,
    });
  });

  it("calls checkout mutation with correct priceId for popular pack", () => {
    render(<BillingPage />);

    const buyButtons = screen.getAllByText("Acheter");
    // Second button is for 50 credits (popular)
    fireEvent.click(buyButtons[1]!);

    expect(mockCheckoutMutate).toHaveBeenCalledWith({
      priceId: "price_50",
      credits: 50,
    });
  });

  // ── Empty purchase history ────────────────────────────────────

  it("shows empty purchase history section", () => {
    render(<BillingPage />);

    expect(screen.getByText("Historique des achats")).toBeInTheDocument();
    expect(screen.getByText("Aucun achat pour le moment")).toBeInTheDocument();
  });

  it("shows scroll to credit packs button in purchase history", () => {
    render(<BillingPage />);

    const scrollButton = screen.getByRole("button", { name: "Acheter des crédits" });
    expect(scrollButton).toBeInTheDocument();
  });

  // ── Error state for credits query ────────────────────────────

  it("shows 0 credits when query has error", () => {
    mockCreditsQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Error loading credits" },
    });

    render(<BillingPage />);

    // Falls back to 0
    expect(screen.getByText(/0 crédit/)).toBeInTheDocument();
  });
});
