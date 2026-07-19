import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Eye: () => <svg data-testid="icon-eye" />,
  EyeOff: () => <svg data-testid="icon-eye-off" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

// Mock MarketingNav
vi.mock("@/components/layout/MarketingNav", () => ({
  MarketingNav: () => <nav data-testid="marketing-nav" />,
}));

// Mock @/components/ui
vi.mock("@echoroom/ui", () => ({
  Button: ({ children, onClick, variant, className, disabled, type, ...props }: any) => (
    <button
      onClick={onClick}
      data-variant={variant}
      className={className}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  ),
  Input: (props: any) => <input {...props} />,
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

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import LoginPage from "../page";

describe("LoginPage", () => {
  const mockRouter = { push: vi.fn(), refresh: vi.fn() };

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);
  });

  it("renders login form with email and password fields", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    // Use placeholder to avoid ambiguity with show/hide password button aria-label
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /se connecter/i })).toBeInTheDocument();
  });

  it("shows register and forgot password links", () => {
    render(<LoginPage />);

    expect(screen.getByRole("link", { name: /s'inscrire/i })).toHaveAttribute("href", "/register");
  });

  it("calls signIn with credentials on submit", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "test@test.com",
        password: "password123",
        redirect: false,
      });
    });
  });

  it("shows error for invalid credentials", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "Invalid credentials",
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "wrong@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "wrong");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByText(/email ou mot de passe incorrect/i)).toBeInTheDocument();
  });

  it("navigates to dashboard on success", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({ error: null });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@test.com");
    await user.type(screen.getByPlaceholderText("••••••••"), "password123");
    await user.click(screen.getByRole("button", { name: /se connecter/i }));

    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const passwordInput = screen.getByPlaceholderText("••••••••");
    expect(passwordInput).toHaveAttribute("type", "password");

    const toggleButton = screen.getByRole("button", {
      name: /afficher le mot de passe/i,
    });
    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute("type", "text");
  });
});
