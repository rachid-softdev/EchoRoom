import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// More flexible mocks for testing isPending / error states on CreatePage
// These supplement the existing page.test.tsx tests
// ---------------------------------------------------------------------------

const mockCharactersQuery = vi.hoisted(() => vi.fn());
const mockCreateMutate = vi.hoisted(() => vi.fn());
const mockGenerateScriptMutate = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());
const mockUseGenerateScriptMutation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  api: {
    characters: {
      list: {
        useQuery: (...args: unknown[]) => (mockCharactersQuery as any)(...args),
      },
    },
    scenarios: {
      create: {
        useMutation: (...args: unknown[]) => (mockUseMutation as any)(...args),
      },
      generateScript: {
        useMutation: (...args: unknown[]) => (mockUseGenerateScriptMutation as any)(...args),
      },
    },
  },
}));

// Mock useApiToast
vi.mock("@/lib/trpc-error", () => ({
  useApiToast: vi.fn((mutation, opts) => ({
    ...mutation,
    mutate: (...args: unknown[]) => {
      mockCreateMutate(...args);
      opts?.onSuccess?.();
    },
    isPending: mutation.isPending,
  })),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Loader2: () => <svg data-testid="icon-loader" data-test-loading="true" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
}));

vi.mock("@echoroom/ui", () => ({
  Button: ({ children, onClick, disabled, type, className, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} className={className} {...props}>
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, id, required, minLength, maxLength, ...props }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      data-testid={id ? `input-${id}` : "input"}
      {...props}
    />
  ),
  Textarea: ({ value, onChange, placeholder, id, maxLength, className, ...props }: any) => (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      className={className}
      data-testid={id ? `textarea-${id}` : "textarea"}
      {...props}
    />
  ),
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} className={className} {...props}>
      {children}
    </span>
  ),
  toast: mockToast,
}));

vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({ query, children, isEmpty, empty }: any) => {
    if (query.isLoading) {
      return <div data-testid="loader-loading">Chargement des personnages...</div>;
    }
    if (query.isError) {
      return (
        <div data-testid="loader-error">
          <p>Une erreur est survenue</p>
          <p>{query.error?.message ?? "Impossible de charger les données."}</p>
          <button type="button" onClick={query.refetch}>Réessayer</button>
        </div>
      );
    }
    if (isEmpty(query.data)) {
      return <div data-testid="loader-empty">{empty}</div>;
    }
    return <div data-testid="loader-data">{children(query.data)}</div>;
  },
}));

vi.mock("@/lib/constants", () => ({
  CATEGORY_LABELS: {
    ROMANTIC: "Romantique",
    CHAOTIC: "Chaotique",
    NPC: "NPC",
  },
}));

import CreatePage from "../page";

const mockCharacters = [
  { id: "char-1", name: "Roméo", category: "ROMANTIC" },
  { id: "char-2", name: "Clown", category: "CHAOTIC" },
];

describe("CreatePage — extended states", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Default: mutation returns not pending
    mockUseMutation.mockReturnValue({
      mutate: (...args: unknown[]) => mockCreateMutate(...args),
      isPending: false,
    });
    mockUseGenerateScriptMutation.mockImplementation((opts?: any) => ({
      mutate: (...args: unknown[]) => {
        mockGenerateScriptMutate(...args);
        opts?.onSuccess?.({
          suggestedOpening: "Generated opening",
          suggestedResponses: ["Response 1", "Response 2"],
        });
      },
      isPending: false,
    }));
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: mockCharacters,
      isError: false,
    });
  });

  // ── Mutation loading states ───────────────────────────────────

  it("shows Loader2 icon in submit button when createScenario.isPending", () => {
    mockUseMutation.mockReturnValue({
      mutate: (...args: unknown[]) => mockCreateMutate(...args),
      isPending: true,
    });

    const { container } = render(<CreatePage />);

    // Select a character first (button is disabled without it)
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // Find submit button by type="submit" (text "Créer le scénario" not rendered when isPending)
    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton).toBeDisabled();
    // The Loader2 icon should be inside the button
    const loaderInButton = submitButton!.querySelector('[data-testid="icon-loader"]');
    expect(loaderInButton).toBeInTheDocument();
  });

  it("shows Loader2 icon in AI assistant button when generateScript.isPending", () => {
    mockUseGenerateScriptMutation.mockImplementation((_opts?: any) => ({
      mutate: (...args: unknown[]) => {
        mockGenerateScriptMutate(...args);
      },
      isPending: true,
    }));

    render(<CreatePage />);

    // Select a character
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // AI assistant button should be disabled
    const aiButton = screen.getByText("Assistant IA").closest("button");
    expect(aiButton).toBeDisabled();
    // Should show loader icon
    const loaderInAI = aiButton!.querySelector('[data-testid="icon-loader"]');
    expect(loaderInAI).toBeInTheDocument();
  });

  // ── Character query error state ───────────────────────────────

  it("shows error state when characters query fails", () => {
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Échec de chargement des personnages" },
      refetch: vi.fn(),
    });

    render(<CreatePage />);

    // DataLoader should show error state since our mock handles isError
    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
    expect(screen.getByText("Échec de chargement des personnages")).toBeInTheDocument();
  });

  it("shows error with generic message when error has no message", () => {
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<CreatePage />);

    expect(screen.getByTestId("loader-error")).toBeInTheDocument();
    expect(screen.getByText("Impossible de charger les données.")).toBeInTheDocument();
  });

  it("provides a retry button when characters query fails", () => {
    const refetch = vi.fn();
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Error" },
      refetch,
    });

    render(<CreatePage />);

    const retryButton = screen.getByRole("button", { name: "Réessayer" });
    fireEvent.click(retryButton);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // ── Generate script error state ───────────────────────────────

  it("shows error toast when generateScript fails", () => {
    mockUseGenerateScriptMutation.mockImplementation((opts?: any) => {
      const onError = opts?.onError;
      return {
        mutate: (...args: unknown[]) => {
          if (onError) onError({ message: "Erreur génération" });
          mockGenerateScriptMutate(...args);
        },
        isPending: false,
      };
    });

    render(<CreatePage />);

    // Select a character
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // Click AI assistant
    const aiButton = screen.getByText("Assistant IA").closest("button");
    fireEvent.click(aiButton!);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur génération",
        variant: "destructive",
      }),
    );
  });

  it("shows generic error toast when generateScript error has no message", () => {
    mockUseGenerateScriptMutation.mockImplementation((opts?: any) => {
      const onError = opts?.onError;
      return {
        mutate: (...args: unknown[]) => {
          if (onError) onError({});
          mockGenerateScriptMutate(...args);
        },
        isPending: false,
      };
    });

    render(<CreatePage />);

    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    const aiButton = screen.getByText("Assistant IA").closest("button");
    fireEvent.click(aiButton!);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur lors de la génération du script",
        variant: "destructive",
      }),
    );
  });

  // ── Submit disabled when isPending ─────────────────────────────

  it("submit button is disabled when createScenario.isPending", () => {
    mockUseMutation.mockReturnValue({
      mutate: (...args: unknown[]) => mockCreateMutate(...args),
      isPending: true,
    });

    const { container } = render(<CreatePage />);

    // Even with character selected, submit should be disabled during pending
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    const submitButton = container.querySelector('button[type="submit"]');
    expect(submitButton).toBeDisabled();
  });

  // ── Form field validation (title is required with minLength) ───

  it("title input has required attribute and minLength constraint", () => {
    render(<CreatePage />);

    const titleInput = screen.getByTestId("input-title");
    expect(titleInput).toHaveAttribute("required");
    expect(titleInput).toHaveAttribute("minLength", "3");
    expect(titleInput).toHaveAttribute("maxLength", "80");
  });

  // ── Navigation on create success ──────────────────────────────

  it("navigates to /dashboard on successful scenario creation", () => {
    // useApiToast mock already calls opts.onSuccess which calls router.push
    render(<CreatePage />);

    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    const titleInput = screen.getByTestId("input-title");
    fireEvent.change(titleInput, { target: { value: "Test" } });

    const submitButton = screen.getByText("Créer le scénario").closest("button");
    fireEvent.click(submitButton!);

    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  // ── AI assistant disabled with no character selected ──────────

  it("disables AI assistant button when generateScript.isPending even with character", () => {
    mockUseGenerateScriptMutation.mockImplementation((_opts?: any) => ({
      mutate: (...args: unknown[]) => mockGenerateScriptMutate(...args),
      isPending: true,
    }));

    render(<CreatePage />);

    const aiButton = screen.getByText("Assistant IA").closest("button");
    expect(aiButton).toBeDisabled();
  });

  // ── Empty character data edge case ────────────────────────────

  it("renders empty state when characters data is empty array", () => {
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: [],
      isError: false,
    });

    render(<CreatePage />);

    expect(screen.getByTestId("loader-empty")).toBeInTheDocument();
  });
});
