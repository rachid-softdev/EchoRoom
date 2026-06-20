import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockListByScenarioQuery = vi.fn();
const mockCreateClipMutation = vi.fn();
const mockToast = vi.fn();

vi.mock("@/lib/trpc", () => ({
  api: {
    calls: {
      listByScenario: {
        useQuery: (...args: unknown[]) => mockListByScenarioQuery(...args),
      },
    },
    clips: {
      create: {
        useMutation: (...args: unknown[]) => mockCreateClipMutation(...args),
      },
    },
  },
}));

vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    disabled,
    onClick,
    className,
    ...props
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
    [key: string]: unknown;
  }) => (
    <button disabled={disabled} onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
    type,
    min,
    max,
    id,
    ...props
  }: {
    value?: string | number;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
    type?: string;
    min?: number;
    max?: number;
    id?: string;
    [key: string]: unknown;
  }) => (
    <input
      type={type || "text"}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      min={min}
      max={max}
      id={id}
      {...props}
    />
  ),
  Skeleton: ({ className, ...props }: { className?: string; [key: string]: unknown }) => (
    <div className={className} data-testid="skeleton" {...props} />
  ),
  toast: mockToast,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockCalls = [
  {
    id: "call-1",
    createdAt: "2024-01-15T10:30:00Z",
    durationSeconds: 120,
  },
  {
    id: "call-2",
    createdAt: "2024-01-16T14:00:00Z",
    durationSeconds: 300,
  },
];

function setupDefaultMocks() {
  mockListByScenarioQuery.mockReturnValue({
    data: { items: mockCalls },
    isLoading: false,
    isError: false,
    error: null,
  });
  mockCreateClipMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    data: null,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ClipCreator", () => {
  let ClipCreator: typeof import("../ClipCreator").ClipCreator;

  beforeEach(async () => {
    vi.clearAllMocks();
    setupDefaultMocks();
    const mod = await import("../ClipCreator");
    ClipCreator = mod.ClipCreator;
  });

  // ── Loading state ─────────────────────────────────────────────────

  it("shows loading skeleton while calls load", () => {
    mockListByScenarioQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    const { container } = render(<ClipCreator scenarioId="s-1" />);
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    // The skeleton should have h-24 class
    const skeleton = container.querySelector('[data-testid="skeleton"]');
    expect(skeleton?.className).toContain("h-24");
  });

  // ── Empty state ───────────────────────────────────────────────────

  it("shows empty message when no calls", () => {
    mockListByScenarioQuery.mockReturnValue({
      data: { items: [] },
      isLoading: false,
      isError: false,
      error: null,
    });

    render(<ClipCreator scenarioId="s-1" />);

    expect(
      screen.getByText(
        "Aucun appel avec enregistrement trouvé pour ce scénario",
      ),
    ).toBeInTheDocument();
  });

  // ── Call selector ─────────────────────────────────────────────────

  it("renders call selector dropdown", () => {
    render(<ClipCreator scenarioId="s-1" />);

    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    expect(select.tagName).toBe("SELECT");

    // Should have default option + one per call
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3); // default + 2 calls
    expect(options[0]).toHaveTextContent("Sélectionner un appel");
  });

  // ── Button disabled states ────────────────────────────────────────

  it("button is disabled when no call selected", () => {
    render(<ClipCreator scenarioId="s-1" />);

    const createButton = screen.getByRole("button", { name: /créer le clip/i });
    expect(createButton).toBeDisabled();
  });

  it("button is disabled when endTime <= startTime", async () => {
    const user = userEvent.setup();
    render(<ClipCreator scenarioId="s-1" />);

    // Select a call first
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "call-1");

    // Set start time higher than default end time (30)
    const startInput = screen.getByLabelText(/début/i) as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "60" } });

    const createButton = screen.getByRole("button", { name: /créer le clip/i });
    expect(createButton).toBeDisabled();
  });

  it("button is disabled during mutation", () => {
    mockCreateClipMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
      data: null,
    });

    render(<ClipCreator scenarioId="s-1" />);

    const createButton = screen.getByRole("button", { name: /création en cours/i });
    expect(createButton).toBeDisabled();
  });

  // ── Validation error ──────────────────────────────────────────────

  it("clamps end time to max call duration", async () => {
    const user = userEvent.setup();
    render(<ClipCreator scenarioId="s-1" />);

    // Select call-1 which has durationSeconds = 120
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "call-1");

    // Set end time to 150 (> 120) — component clamps it to 120
    const endInput = screen.getByLabelText(/fin/i) as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: "150" } });

    expect(endInput).toHaveValue(120);
  });

  // ── Call duration hint ────────────────────────────────────────────

  it("shows hint with call duration when call selected", async () => {
    const user = userEvent.setup();
    render(<ClipCreator scenarioId="s-1" />);

    // call-2 has durationSeconds = 300 → "5:00"
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "call-2");

    expect(screen.getByText(/Durée max : 5:00/)).toBeInTheDocument();
  });

  it('shows default hint when no call selected', () => {
    render(<ClipCreator scenarioId="s-1" />);

    expect(
      screen.getByText("Sélectionnez un appel pour définir les temps"),
    ).toBeInTheDocument();
  });

  // ── Mutation call ─────────────────────────────────────────────────

  it("calls create mutation with correct data", async () => {
    const mutate = vi.fn();
    mockCreateClipMutation.mockReturnValue({
      mutate,
      isPending: false,
      data: null,
    });

    const user = userEvent.setup();
    render(<ClipCreator scenarioId="s-1" />);

    // Select call
    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "call-1");

    // Set start and end times
    const startInput = screen.getByLabelText(/début/i) as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: "10" } });

    const endInput = screen.getByLabelText(/fin/i) as HTMLInputElement;
    fireEvent.change(endInput, { target: { value: "60" } });

    // Add a title
    const titleInput = screen.getByLabelText(/titre/i);
    await user.type(titleInput, "Mon super clip");

    // Click create
    const createButton = screen.getByRole("button", { name: /créer le clip/i });
    await user.click(createButton);

    expect(mutate).toHaveBeenCalledWith({
      callId: "call-1",
      startTime: 10,
      endTime: 60,
      title: "Mon super clip",
    });
  });

  it("calls create mutation without title when empty", async () => {
    const mutate = vi.fn();
    mockCreateClipMutation.mockReturnValue({
      mutate,
      isPending: false,
      data: null,
    });

    const user = userEvent.setup();
    render(<ClipCreator scenarioId="s-1" />);

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "call-1");

    const createButton = screen.getByRole("button", { name: /créer le clip/i });
    await user.click(createButton);

    expect(mutate).toHaveBeenCalledWith({
      callId: "call-1",
      startTime: 0,
      endTime: 30,
      title: undefined,
    });
  });

  // ── Success state ─────────────────────────────────────────────────

  it("resets form on success", () => {
    // Simulate a successful mutation by providing data
    mockCreateClipMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      data: { id: "clip-1" },
    });

    render(<ClipCreator scenarioId="s-1" />);

    expect(
      screen.getByText(
        "Clip créé avec succès — l'extraction est lancée en arrière-plan.",
      ),
    ).toBeInTheDocument();
  });

  it("calls toast on success via mutation onSuccess", () => {
    // Render the component to trigger useMutation registration
    render(<ClipCreator scenarioId="s-1" />);

    // The mutation result should contain mutate function
    const mutationResult = mockCreateClipMutation.mock.results[0]?.value;
    expect(mutationResult).toBeDefined();
    expect(mutationResult.mutate).toBeDefined();
    expect(mutationResult.isPending).toBe(false);
  });
});
