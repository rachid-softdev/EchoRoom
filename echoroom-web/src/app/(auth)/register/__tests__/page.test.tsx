import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Hoisted mocks for dynamic mutation state ──────────────────────────
const mockMutate = vi.hoisted(() => vi.fn());
const mockMutationState = vi.hoisted(() => ({
  isPending: false,
  error: null as { message: string } | null,
}));
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
  useSession: vi.fn(() => ({ data: null, status: "unauthenticated" })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, refresh: mockRefresh })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

// Mock tRPC with dynamic mutation state (getters for live reads)
vi.mock("@/lib/trpc", () => ({
  api: {
    auth: {
      register: {
        useMutation: vi.fn(() => ({
          mutate: (...args: any[]) => mockMutate(...args),
          get isPending() {
            return mockMutationState.isPending;
          },
          get error() {
            return mockMutationState.error;
          },
          mutateAsync: (...args: any[]) => mockMutate(...args),
        })),
      },
    },
  },
}));

// Mock useApiToast wrapper — calls onSuccess when mutate is invoked
vi.mock("@/lib/trpc-error", () => ({
  useApiToast: vi.fn((mutation, opts) => ({
    ...mutation,
    mutate: (...args: any[]) => {
      mockMutate(...args);
      opts?.onSuccess?.();
    },
  })),
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

// Mock PasswordStrengthMeter — forward password so tests can assert
vi.mock("@/components/shared/PasswordStrengthMeter", () => ({
  PasswordStrengthMeter: ({ password }: { password: string }) => (
    <div data-testid="password-strength-meter" data-password={password} />
  ),
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
  Button: ({ children, onClick, variant, className, disabled, type, ...props }: any) => (
    <button onClick={onClick} data-variant={variant} className={className} disabled={disabled} type={type} {...props}>
      {children}
    </button>
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
import RegisterPage from "../page";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RegisterPage", () => {
  afterEach(() => {
    cleanup();
    // Reset dynamic mutation state for the next test
    mockMutationState.isPending = false;
    mockMutationState.error = null;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Static rendering tests ──────────────────────────────────────────

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

  // ── HTML5 validation attribute tests ────────────────────────────────

  it("has required attribute on email field", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("required");
  });

  it("has required attribute on username field", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/nom d'utilisateur/i)).toHaveAttribute("required");
  });

  it("has required attribute on password field", () => {
    render(<RegisterPage />);
    expect(screen.getByPlaceholderText("Minimum 8 caractères")).toHaveAttribute("required");
  });

  it("email field has type=email for built-in validation", () => {
    render(<RegisterPage />);
    expect(screen.getByLabelText(/email/i)).toHaveAttribute("type", "email");
  });

  // ── Password visibility toggle tests ────────────────────────────────

  it("password field starts hidden", () => {
    render(<RegisterPage />);
    expect(screen.getByPlaceholderText("Minimum 8 caractères")).toHaveAttribute("type", "password");
  });

  it("toggles password visibility on button click", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const passwordInput = screen.getByPlaceholderText("Minimum 8 caractères");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: /afficher le mot de passe/i }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /masquer le mot de passe/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  // ── Form validation tests ───────────────────────────────────────────

  it("prevents submission when consent is not accepted", () => {
    const { container } = render(<RegisterPage />);

    // Button is disabled when consent is unchecked
    expect(
      screen.getByRole("button", { name: /créer mon compte/i }),
    ).toBeDisabled();

    // Bypass the disabled button to test the handleSubmit guard
    const form = container.querySelector("form")!;
    fireEvent.submit(form);

    expect(
      screen.getByText("Vous devez accepter les conditions d'utilisation"),
    ).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it("disables submit button when password is weak", () => {
    render(<RegisterPage />);

    // passwordStrength = 0 (empty password) → button disabled
    expect(
      screen.getByRole("button", { name: /créer mon compte/i }),
    ).toBeDisabled();
  });

  it("enables submit button when consent is given and password is strong enough", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    // Type a password that passes >=3 checks: "StrongPass1" has length 11 (≥8 ✓, ≥12 ✗),
    // uppercase ✓, digit ✓ → score = 3
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "StrongPass1");
    await user.click(screen.getByRole("checkbox"));

    expect(
      screen.getByRole("button", { name: /créer mon compte/i }),
    ).not.toBeDisabled();
  });

  // ── Password strength meter tests ───────────────────────────────────

  it("does not show strength meter when password is empty", () => {
    render(<RegisterPage />);

    expect(screen.queryByTestId("password-strength-meter")).not.toBeInTheDocument();
  });

  it("shows strength meter when user types a password", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "abc");

    expect(screen.getByTestId("password-strength-meter")).toBeInTheDocument();
  });

  it("passes the password value to the strength meter component", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(
      screen.getByPlaceholderText("Minimum 8 caractères"),
      "Test123!",
    );

    expect(screen.getByTestId("password-strength-meter")).toHaveAttribute(
      "data-password",
      "Test123!",
    );
  });

  // ── Loading / isPending state tests ─────────────────────────────────

  it("disables all form inputs during submission", () => {
    mockMutationState.isPending = true;
    render(<RegisterPage />);

    expect(screen.getByLabelText(/email/i)).toBeDisabled();
    expect(screen.getByLabelText(/nom d'utilisateur/i)).toBeDisabled();
    expect(screen.getByPlaceholderText("Minimum 8 caractères")).toBeDisabled();
  });

  it("shows loading spinner and disables submit button during submission", () => {
    mockMutationState.isPending = true;
    render(<RegisterPage />);

    // Loading replaces button text with spinner → query by data-testid
    const loader = screen.getByTestId("icon-loader");
    expect(loader).toBeInTheDocument();

    // The parent button should be disabled
    const submitButton = loader.closest("button");
    expect(submitButton).toBeDisabled();
  });

  it("hides loading spinner when not submitting", () => {
    render(<RegisterPage />);

    expect(screen.queryByTestId("icon-loader")).not.toBeInTheDocument();
  });

  // ── API error display tests ─────────────────────────────────────────

  it("displays no error when mutation has no error", () => {
    render(<RegisterPage />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("displays API error message from the mutation", () => {
    mockMutationState.error = { message: "Email déjà utilisé" };
    render(<RegisterPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Email déjà utilisé");
  });

  it("displays duplicate email error specifically", () => {
    mockMutationState.error = { message: "Email déjà utilisé" };
    render(<RegisterPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Email déjà utilisé");
  });

  it("displays a generic server error message", () => {
    mockMutationState.error = { message: "Erreur serveur" };
    render(<RegisterPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("Erreur serveur");
  });

  it("links error message to form inputs via aria-describedby", () => {
    mockMutationState.error = { message: "Email déjà utilisé" };
    render(<RegisterPage />);

    // When an error exists, inputs get aria-describedby pointing to the error
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute("aria-describedby", "register-error");
  });

  // ── Form submission success flow tests ──────────────────────────────

  it("calls register mutation with form data on submit", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), "newuser");
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "SecurePass1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith({
        email: "user@example.com",
        username: "newuser",
        password: "SecurePass1!",
        consentAccepted: true,
      });
    });
  });

  it("calls signIn with credentials after successful registration", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), "newuser");
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "SecurePass1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(signIn).toHaveBeenCalledWith("credentials", {
        email: "user@example.com",
        password: "SecurePass1!",
        redirect: false,
      });
    });
  });

  it("redirects to /dashboard after successful registration", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), "newuser");
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "SecurePass1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("calls router.refresh after successful registration", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), "newuser");
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "SecurePass1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  // ── SignIn failure after registration tests ─────────────────────────

  it("handles signIn failure after account creation gracefully", async () => {
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValue({
      error: "CredentialsSignin",
    });

    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.type(screen.getByLabelText(/email/i), "user@example.com");
    await user.type(screen.getByLabelText(/nom d'utilisateur/i), "newuser");
    await user.type(screen.getByPlaceholderText("Minimum 8 caractères"), "SecurePass1!");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Compte créé mais erreur de connexion. Veuillez vous connecter.",
        ),
      ).toBeInTheDocument();
    });

    // Should NOT redirect to dashboard when signIn fails
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("links to login page for existing accounts", () => {
    render(<RegisterPage />);

    const loginLink = screen.getByRole("link", { name: /se connecter/i });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("renders the card header with description", () => {
    render(<RegisterPage />);

    expect(screen.getByText("Créer un compte")).toBeInTheDocument();
    expect(
      screen.getByText("5 crédits offerts pour commencer"),
    ).toBeInTheDocument();
  });
});
