import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    billing: {
      createCheckout: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
          error: null,
          data: null,
        })),
      },
    },
  },
}));

// Mock trpc-error (useApiToast wrapper)
vi.mock("@/lib/trpc-error", () => ({
  useApiToast: vi.fn((mutation) => mutation),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock MarketingNav
vi.mock("@/components/layout/MarketingNav", () => ({
  MarketingNav: () => <nav data-testid="marketing-nav" />,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Check: () => <svg data-testid="icon-check" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

// Mock @/components/ui (Badge, Button, Card, etc.)
vi.mock("@/components/ui", () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
  Button: ({ children, onClick, variant, className, disabled, ...props }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      className={className}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  ),
  Card: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardDescription: ({ children, className, ...props }: any) => (
    <p className={className} {...props}>
      {children}
    </p>
  ),
  CardHeader: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, className, ...props }: any) => (
    <h2 className={className} {...props}>
      {children}
    </h2>
  ),
}));

import { useSession } from "next-auth/react";
import PricingPage from "../page";

describe("PricingPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pricing plans", () => {
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<PricingPage />);

    // The plan label names are "Découverte", "Starter", "Pro" from PRICING_CONFIG
    expect(screen.getByText("Découverte")).toBeInTheDocument();
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });

  it("shows register link for free plan", () => {
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    render(<PricingPage />);

    // Free plan CTA is "Commencer" — link wraps the button with that text
    const commencerLink = screen.getByRole("link", { name: /commencer/i });
    expect(commencerLink).toHaveAttribute("href", "/register");
  });

  it("does not crash when session is loading", () => {
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: undefined,
      status: "loading",
    });

    render(<PricingPage />);

    // Session loading should still render plan prices
    expect(screen.getByText("Gratuit")).toBeInTheDocument();
    expect(screen.getByText(/9,99/)).toBeInTheDocument();
    expect(screen.getByText(/24,99/)).toBeInTheDocument();
  });
});
