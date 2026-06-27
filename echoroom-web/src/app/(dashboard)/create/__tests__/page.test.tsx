import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks for vi.mock factories
const mockCharactersQuery = vi.hoisted(() => vi.fn());
const mockCreateMutate = vi.hoisted(() => vi.fn());
const mockGenerateScriptMutate = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

const mockCreateIsPending = false;
const mockGenerateIsPending = false;

vi.mock("@/lib/trpc", () => ({
  api: {
    characters: {
      list: {
        useQuery: (...args: unknown[]) => (mockCharactersQuery as any)(...args),
      },
    },
    scenarios: {
      create: {
        useMutation: vi.fn(() => ({
          mutate: (...args: unknown[]) => mockCreateMutate(...args),
          isPending: mockCreateIsPending,
        })),
      },
      generateScript: {
        useMutation: vi.fn((opts?: any) => ({
          mutate: (...args: unknown[]) => {
            mockGenerateScriptMutate(...args);
            opts?.onSuccess?.({
              suggestedOpening: "Generated opening",
              suggestedResponses: ["Response 1", "Response 2"],
            });
          },
          isPending: mockGenerateIsPending,
        })),
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
    isPending: false,
  })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ArrowLeft: () => <svg data-testid="icon-arrow-left" />,
  Loader2: () => <svg data-testid="icon-loader" data-test-loading="true" />,
  Sparkles: () => <svg data-testid="icon-sparkles" />,
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
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

// Mock DataLoader
vi.mock("@/components/shared/DataLoader", () => ({
  DataLoader: ({ query, children, isEmpty, empty }: any) => {
    if (query.isLoading) {
      return <div data-testid="loader-loading">Chargement des personnages...</div>;
    }
    if (isEmpty(query.data)) {
      return <div data-testid="loader-empty">{empty}</div>;
    }
    return <div data-testid="loader-data">{children(query.data)}</div>;
  },
}));

// Mock CATEGORY_LABELS
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
  { id: "char-3", name: "Guard", category: "NPC" },
];

describe("CreatePage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: mockCharacters,
      isError: false,
    });
  });

  it("renders the page title and description", () => {
    render(<CreatePage />);

    expect(screen.getByText("Créer un scénario")).toBeInTheDocument();
    expect(
      screen.getByText("Définissez le personnage, le contexte et les instructions IA"),
    ).toBeInTheDocument();
  });

  it("renders navigation with back link and cancel button", () => {
    render(<CreatePage />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Annuler")).toBeInTheDocument();
  });

  it("renders character selection grid", () => {
    render(<CreatePage />);

    expect(screen.getByText("Personnage IA")).toBeInTheDocument();
    expect(screen.getByText("Roméo")).toBeInTheDocument();
    expect(screen.getByText("Clown")).toBeInTheDocument();
    expect(screen.getByText("Guard")).toBeInTheDocument();

    // Check category labels
    expect(screen.getByText("Romantique")).toBeInTheDocument();
    expect(screen.getByText("Chaotique")).toBeInTheDocument();
    expect(screen.getByText("NPC")).toBeInTheDocument();
  });

  it("shows loading state for characters", () => {
    mockCharactersQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
    });

    render(<CreatePage />);

    expect(screen.getByTestId("loader-loading")).toBeInTheDocument();
  });

  it("shows empty state when no characters available", () => {
    mockCharactersQuery.mockReturnValue({
      isLoading: false,
      data: [],
      isError: false,
    });

    render(<CreatePage />);

    expect(screen.getByTestId("loader-empty")).toBeInTheDocument();
  });

  it("selects a character when clicked", () => {
    render(<CreatePage />);

    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // Character button should now have primary styling
    expect(characterButton!.className).toContain("border-primary");
  });

  it("submit button is disabled when no character is selected", () => {
    render(<CreatePage />);

    const submitButton = screen.getByText("Créer le scénario").closest("button");
    expect(submitButton).toBeDisabled();
  });

  it("submit button is enabled when a character is selected", () => {
    render(<CreatePage />);

    // Select a character first
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    const submitButton = screen.getByText("Créer le scénario").closest("button");
    expect(submitButton).not.toBeDisabled();
  });

  it("submits the form with correct data", () => {
    render(<CreatePage />);

    // Select character
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // Fill in title
    const titleInput = screen.getByTestId("input-title");
    fireEvent.change(titleInput, { target: { value: "Test Scenario" } });

    // Fill in description
    const descTextarea = screen.getByTestId("textarea-description");
    fireEvent.change(descTextarea, { target: { value: "A test scenario" } });

    // Fill in opening message
    const openingTextarea = screen.getByTestId("textarea-openingMessage");
    fireEvent.change(openingTextarea, { target: { value: "Hello there!" } });

    // Fill in AI instructions
    const aiTextarea = screen.getByTestId("textarea-aiInstructions");
    fireEvent.change(aiTextarea, { target: { value: "Be friendly" } });

    // Submit form
    const submitButton = screen.getByText("Créer le scénario").closest("button");
    fireEvent.click(submitButton!);

    expect(mockCreateMutate).toHaveBeenCalledWith({
      characterId: "char-1",
      title: "Test Scenario",
      description: "A test scenario",
      openingMessage: "Hello there!",
      aiInstructions: "Be friendly",
      visibility: "PUBLIC",
    });
  });

  it("changes visibility to private", () => {
    render(<CreatePage />);

    const privateButton = screen.getByText("Privé");
    fireEvent.click(privateButton);

    expect(privateButton.className).toContain("border-primary");
  });

  it("shows visibility options", () => {
    render(<CreatePage />);

    expect(screen.getByText("Public")).toBeInTheDocument();
    expect(screen.getByText("Privé")).toBeInTheDocument();
    expect(screen.getByText("Visibilité")).toBeInTheDocument();
  });

  it("renders AI assistant button and generates script", () => {
    render(<CreatePage />);

    // Select a character first
    const characterButton = screen.getByText("Roméo").closest("button");
    fireEvent.click(characterButton!);

    // Click AI assistant button
    const aiButton = screen.getByText("Assistant IA");
    fireEvent.click(aiButton);

    // Should call generateScript mutation
    expect(mockGenerateScriptMutate).toHaveBeenCalledWith({
      characterId: "char-1",
      title: "",
      description: "",
      openingMessage: "",
    });
  });

  it("renders form fields with correct labels and placeholders", () => {
    render(<CreatePage />);

    expect(screen.getByText("Titre du scénario")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Message d'ouverture")).toBeInTheDocument();
    expect(screen.getByText("Instructions IA")).toBeInTheDocument();

    expect(screen.getByPlaceholderText("Ex: Le speed dating catastrophique")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Décrivez le contexte du scénario...")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ce que le personnage dit au début de l'appel..."),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Instructions détaillées pour le comportement de l'IA..."),
    ).toBeInTheDocument();
  });

  it("shows character count for AI instructions", () => {
    render(<CreatePage />);

    const aiTextarea = screen.getByTestId("textarea-aiInstructions");
    fireEvent.change(aiTextarea, { target: { value: "Hello" } });

    // Character count should be shown
    expect(screen.getByText(/5\/3000 caractères/)).toBeInTheDocument();
  });

  it("disables AI assistant button when no character is selected", () => {
    render(<CreatePage />);

    const aiButton = screen.getByText("Assistant IA").closest("button");
    expect(aiButton).toBeDisabled();
  });
});
