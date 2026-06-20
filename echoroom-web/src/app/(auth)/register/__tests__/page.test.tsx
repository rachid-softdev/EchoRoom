import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    auth: {
      register: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
          error: null,
        })),
      },
    },
  },
}));

// Mock useApiToast wrapper
vi.mock("@/lib/trpc-error", () => ({
  useApiToast: vi.fn((mutation) => mutation),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Eye: () => <svg data-testid="icon-eye" />,
  EyeOff: () => <svg data-testid="icon-eye-off" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  Check: () => <svg data-testid="icon-check" />,
}));

// Mock MarketingNav
vi.mock("@/components/layout/MarketingNav", () => ({
  MarketingNav: () => <nav data-testid="marketing-nav" />,
}));

// Mock PasswordStrengthMeter
vi.mock("@/components/shared/PasswordStrengthMeter", () => ({
  PasswordStrengthMeter: () => <div data-testid="password-strength-meter" />,
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, variant, className, disabled, type, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} disabled={disabled} type={type} {...props}>{children}</button>
  ),
  Input: (props: any) => <input {...props} />,
  Card: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardContent: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardDescription: ({ children, className, ...props }: any) => <p className={className} {...props}>{children}</p>,
  CardHeader: ({ children, className, ...props }: any) => <div className={className} {...props}>{children}</div>,
  CardTitle: ({ children, className, ...props }: any) => <h2 className={className} {...props}>{children}</h2>,
  Checkbox: ({ id, checked, onChange, className, ...props }: any) => (
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className={className} {...props} />
  ),
}));

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/trpc";
import RegisterPage from "../page";

describe("RegisterPage", () => {
  const mockRouter = { push: vi.fn(), refresh: vi.fn() };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);
  });

  it("renders registration form", () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/nom d'utilisateur/i)).toBeInTheDocument();
    // Use placeholder to avoid ambiguity with show/hide password button aria-label
    expect(screen.getByPlaceholderText("Minimum 8 caractères")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /créer mon compte/i }),
    ).toBeInTheDocument();
  });

  it("has username min/max length constraints", () => {
    render(<RegisterPage />);

    const usernameInput = screen.getByLabelText(/nom d'utilisateur/i);
    expect(usernameInput).toHaveAttribute("minLength", "3");
    expect(usernameInput).toHaveAttribute("maxLength", "20");
  });

  it("has password min length constraint", () => {
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText("Minimum 8 caractères");
    expect(passwordInput).toHaveAttribute("minLength", "8");
  });

  it("links to terms and privacy pages", () => {
    render(<RegisterPage />);

    expect(screen.getByRole("link", { name: /conditions d'utilisation/i })).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(screen.getByRole("link", { name: /politique de confidentialité/i })).toHaveAttribute(
      "href",
      "/privacy",
    );
  });
});
