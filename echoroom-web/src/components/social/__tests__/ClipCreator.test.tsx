import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClipCreator } from "../ClipCreator";

// ---------------------------------------------------------------------------
// Mock tRPC — use vi.hoisted() for mutable mutation state
// ---------------------------------------------------------------------------

const mockMutate = vi.hoisted(() => vi.fn());
const mockUseMutation = vi.hoisted(() => vi.fn());

vi.mock("@/lib/trpc", () => ({
  api: {
    social: {
      createClip: {
        useMutation: mockUseMutation,
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock lucide-react
// ---------------------------------------------------------------------------

vi.mock("lucide-react", () => ({
  Scissors: () => <span data-testid="scissors-icon">Scissors</span>,
}));

// ---------------------------------------------------------------------------
// Mock @/components/ui (Input, Button, toast)
// ---------------------------------------------------------------------------

const mockToast = vi.hoisted(() => vi.fn());

vi.mock("@echoroom/ui", () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
  toast: mockToast,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setupDefaultMutation() {
  mockUseMutation.mockReturnValue({
    mutate: mockMutate,
    isPending: false,
  });
}

function setupPendingMutation() {
  mockUseMutation.mockReturnValue({
    mutate: mockMutate,
    isPending: true,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupDefaultMutation();
  mockMutate.mockClear();
  mockToast.mockClear();
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClipCreator", () => {
  const defaultProps = {
    callId: "call-123",
    durationSeconds: 120,
  };

  // ── Rendering ──────────────────────────────────────────────────────

  it("renders title input, start/end inputs, and submit button", () => {
    render(<ClipCreator {...defaultProps} />);

    expect(screen.getByLabelText("Titre (optionnel)")).toBeInTheDocument();
    expect(screen.getByLabelText("Début (secondes)")).toBeInTheDocument();
    expect(screen.getByLabelText("Fin (secondes)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Créer le clip/i })).toBeInTheDocument();
  });

  it("renders Scissors icon", () => {
    render(<ClipCreator {...defaultProps} />);

    expect(screen.getByTestId("scissors-icon")).toBeInTheDocument();
  });

  it("displays the heading 'Créer un clip'", () => {
    render(<ClipCreator {...defaultProps} />);

    expect(screen.getByText("Créer un clip")).toBeInTheDocument();
  });

  // ── Input default values ──────────────────────────────────────────

  it("sets startTime default to 0 and endTime default to durationSeconds", () => {
    render(<ClipCreator callId="call-1" durationSeconds={60} />);

    const startInput = screen.getByLabelText("Début (secondes)") as HTMLInputElement;
    const endInput = screen.getByLabelText("Fin (secondes)") as HTMLInputElement;

    expect(startInput.value).toBe("0");
    expect(endInput.value).toBe("60");
  });

  // ── Submit button state ───────────────────────────────────────────

  it("submit button is enabled when form is valid (start=0, end=duration)", () => {
    render(<ClipCreator {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Créer le clip/i });
    expect(button).not.toBeDisabled();
  });

  it("submit button is disabled when startTime equals endTime", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    // Set start = 60, end = 60 (same value, invalid)
    const startInput = screen.getByLabelText("Début (secondes)");
    const endInput = screen.getByLabelText("Fin (secondes)");

    await user.clear(startInput);
    await user.type(startInput, "60");
    await user.clear(endInput);
    await user.type(endInput, "60");

    const button = screen.getByRole("button", { name: /Créer le clip/i });
    expect(button).toBeDisabled();
  });

  it("submit button is disabled when startTime > endTime", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    const startInput = screen.getByLabelText("Début (secondes)");
    await user.clear(startInput);
    await user.type(startInput, "80");

    const endInput = screen.getByLabelText("Fin (secondes)");
    await user.clear(endInput);
    await user.type(endInput, "30");

    const button = screen.getByRole("button", { name: /Créer le clip/i });
    expect(button).toBeDisabled();
  });

  it("submit button is disabled when mutation is pending", () => {
    setupPendingMutation();

    render(<ClipCreator {...defaultProps} />);

    const button = screen.getByRole("button", { name: /Création\.\.\./i });
    expect(button).toBeDisabled();
  });

  // ── Validation error message ──────────────────────────────────────

  it("shows error message when endTime is less than or equal to startTime", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    // Start with default end=120, set start to 100 — still valid
    // Then set start to 120 — invalid
    const startInput = screen.getByLabelText("Début (secondes)");
    await user.clear(startInput);
    await user.type(startInput, "120");

    // Error should appear because end (120) <= start (120)
    expect(
      screen.getByText("La fin doit être après le début et dans la durée de l'appel"),
    ).toBeInTheDocument();

    // Error disappears when valid again
    await user.clear(startInput);
    await user.type(startInput, "50");

    expect(
      screen.queryByText("La fin doit être après le début et dans la durée de l'appel"),
    ).not.toBeInTheDocument();
  });

  it("hides error message when values are still at defaults (0 / duration)", () => {
    render(<ClipCreator {...defaultProps} />);

    expect(
      screen.queryByText("La fin doit être après le début et dans la durée de l'appel"),
    ).not.toBeInTheDocument();
  });

  // ── Mutate call ───────────────────────────────────────────────────

  it("calls mutate with correct arguments on submit", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    // Set a title
    const titleInput = screen.getByLabelText("Titre (optionnel)");
    await user.type(titleInput, "Mon super clip");

    // Set custom times
    const startInput = screen.getByLabelText("Début (secondes)");
    await user.clear(startInput);
    await user.type(startInput, "10");

    const endInput = screen.getByLabelText("Fin (secondes)");
    await user.clear(endInput);
    await user.type(endInput, "30");

    // Submit
    const submitButton = screen.getByRole("button", { name: /Créer le clip/i });
    await user.click(submitButton);

    expect(mockMutate).toHaveBeenCalledWith({
      callId: "call-123",
      title: "Mon super clip",
      startTime: 10,
      endTime: 30,
    });
  });

  it("calls mutate with undefined title when title is empty or whitespace", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    // Submit with default values (empty title)
    const submitButton = screen.getByRole("button", { name: /Créer le clip/i });
    await user.click(submitButton);

    expect(mockMutate).toHaveBeenCalledWith({
      callId: "call-123",
      title: undefined,
      startTime: 0,
      endTime: 120,
    });
  });

  it("does not call mutate when form is invalid", async () => {
    const user = userEvent.setup();
    render(<ClipCreator {...defaultProps} />);

    // Make form invalid by setting start = end
    const startInput = screen.getByLabelText("Début (secondes)");
    await user.clear(startInput);
    await user.type(startInput, "120");

    // Button should be disabled — use fireEvent.click to bypass disabled check
    const button = screen.getByRole("button", { name: /Créer le clip/i });
    fireEvent.click(button);

    expect(mockMutate).not.toHaveBeenCalled();
  });

  // ── Mutation pending state ────────────────────────────────────────

  it("shows 'Création...' text when mutation is pending", () => {
    setupPendingMutation();

    render(<ClipCreator {...defaultProps} />);

    expect(screen.getByText("Création...")).toBeInTheDocument();
    expect(screen.queryByText("Créer le clip")).not.toBeInTheDocument();
  });

  // ── onSuccess callback ────────────────────────────────────────────

  it("calls toast with success message on mutation success", () => {
    const callbacks: { onSuccess?: () => void } = {};
    mockUseMutation.mockImplementation((opts: { onSuccess?: () => void }) => {
      Object.assign(callbacks, opts);
      return { mutate: mockMutate, isPending: false };
    });

    render(<ClipCreator {...defaultProps} />);

    // Trigger the onSuccess callback
    callbacks.onSuccess?.();

    expect(mockToast).toHaveBeenCalledWith({
      title: "Clip créé !",
      variant: "default",
    });
  });

  it("resets form fields on mutation success", () => {
    const callbacks: { onSuccess?: () => void } = {};
    mockUseMutation.mockImplementation((opts: { onSuccess?: () => void }) => {
      Object.assign(callbacks, opts);
      return { mutate: mockMutate, isPending: false };
    });

    render(<ClipCreator {...defaultProps} />);

    // Set some values, then trigger success
    const titleInput = screen.getByLabelText("Titre (optionnel)") as HTMLInputElement;
    const startInput = screen.getByLabelText("Début (secondes)") as HTMLInputElement;
    const endInput = screen.getByLabelText("Fin (secondes)") as HTMLInputElement;

    fireEvent.change(titleInput, { target: { value: "Test" } });
    fireEvent.change(startInput, { target: { value: "10" } });
    fireEvent.change(endInput, { target: { value: "50" } });

    // Wrap state-triggering callback in act() to flush React state updates
    act(() => {
      callbacks.onSuccess?.();
    });

    expect(titleInput.value).toBe("");
    expect(startInput.value).toBe("0");
    expect(endInput.value).toBe("120");
  });

  // ── onError callback ──────────────────────────────────────────────

  it("calls toast with error message on mutation error", () => {
    const testError = new Error("Erreur de création");
    const callbacks: { onError?: (err: Error) => void } = {};
    mockUseMutation.mockImplementation((opts: { onError?: (err: Error) => void }) => {
      Object.assign(callbacks, opts);
      return { mutate: mockMutate, isPending: false };
    });

    render(<ClipCreator {...defaultProps} />);

    // Trigger the onError callback
    callbacks.onError?.(testError);

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur de création",
      variant: "destructive",
    });
  });

  it("falls back to default error message when err.message is empty", () => {
    const callbacks: { onError?: (err: Error) => void } = {};
    mockUseMutation.mockImplementation((opts: { onError?: (err: Error) => void }) => {
      Object.assign(callbacks, opts);
      return { mutate: mockMutate, isPending: false };
    });

    render(<ClipCreator {...defaultProps} />);

    const errWithoutMessage = new Error();
    callbacks.onError?.(errWithoutMessage);

    expect(mockToast).toHaveBeenCalledWith({
      title: "Erreur lors de la création du clip",
      variant: "destructive",
    });
  });

  // ── Input clamping ────────────────────────────────────────────────

  it("clamps startTime between 0 and durationSeconds", () => {
    render(<ClipCreator {...defaultProps} />);

    const startInput = screen.getByLabelText("Début (secondes)") as HTMLInputElement;

    // Set negative value — should be clamped to 0
    fireEvent.change(startInput, { target: { value: "-5" } });
    expect(startInput.value).toBe("0");

    // Since clamp uses Math.max(0, ...), -5 becomes 0
    // But the onChange handler does: Math.max(0, Math.round(Number(e.target.value)))
    // So -5 → Math.round(-5) = -5 → Math.max(0, -5) = 0
  });
});
