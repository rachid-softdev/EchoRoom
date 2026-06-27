import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    admin: {
      getBlockedNumbers: {
        useQuery: vi.fn(),
      },
      blockNumber: {
        useMutation: vi.fn(),
      },
      unblockNumber: {
        useMutation: vi.fn(),
      },
    },
  },
}));

// Mock toast from UI
vi.mock("@/components/ui", async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...(mod as any),
    toast: vi.fn(),
  };
});

// Mock lucide-react icons used by BlockedNumbersPageClient and DataLoader
vi.mock("lucide-react", () => ({
  Ban: () => <svg data-testid="icon-ban" />,
  Unlock: () => <svg data-testid="icon-unlock" />,
  PhoneOff: () => <svg data-testid="icon-phone-off" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

import { toast } from "@/components/ui";
import { api } from "@/lib/trpc";
import BlockedNumbersPageClient from "../BlockedNumbersPageClient";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const mockBlockedQuery = api.admin.getBlockedNumbers.useQuery as ReturnType<typeof vi.fn>;
const mockBlockMutation = api.admin.blockNumber.useMutation as ReturnType<typeof vi.fn>;
const mockUnblockMutation = api.admin.unblockNumber.useMutation as ReturnType<typeof vi.fn>;

const sampleBlockedEntry = {
  id: "b-1",
  phoneNumber: "+33612345678",
  reason: "Spam",
  createdAt: new Date("2024-06-15"),
  blockedBy: { username: "admin1" },
};

const sampleBlockedEntryNoReason = {
  id: "b-2",
  phoneNumber: "+33698765432",
  reason: null,
  createdAt: new Date("2024-06-16"),
  blockedBy: { username: "admin2" },
};

const sampleBlockedEntryNoBlocker = {
  id: "b-3",
  phoneNumber: "+33655556666",
  reason: "Abus",
  createdAt: new Date("2024-06-17"),
  blockedBy: null,
};

function createMutationMock() {
  const mutate = vi.fn();
  return vi.fn(() => ({
    mutate,
    isPending: false,
  }));
}

function buildQueryMock(data: any[] = [sampleBlockedEntry]) {
  return {
    isLoading: false,
    data: { items: data },
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("BlockedNumbersPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBlockMutation.mockImplementation(createMutationMock());
    mockUnblockMutation.mockImplementation(createMutationMock());
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it("should show loading skeleton when data is loading", () => {
    mockBlockedQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<BlockedNumbersPageClient />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it("should show error state when query fails", () => {
    mockBlockedQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur de chargement" },
      refetch: vi.fn(),
    });

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Erreur de chargement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument();
  });

  it("should call refetch when retry is clicked", () => {
    const refetch = vi.fn();
    mockBlockedQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur" },
      refetch,
    });

    render(<BlockedNumbersPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("should show empty state when no blocked numbers", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText("Aucun numéro bloqué pour le moment.")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Page layout
  // -----------------------------------------------------------------------

  it("should render the page title and description", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    // "Numéros bloqués" appears both as <h1> title and <h3> list heading
    const headings = screen.getAllByText("Numéros bloqués");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Gérez la liste des numéros de téléphone bloqués")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Block form
  // -----------------------------------------------------------------------

  it("should render the block form title", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    expect(screen.getByRole("heading", { name: "Bloquer un numéro" })).toBeInTheDocument();
    expect(screen.getByText("Ajoutez un numéro à la liste de blocage")).toBeInTheDocument();
  });

  it("should render phone number and reason inputs", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    expect(screen.getByPlaceholderText("+33612345678")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Motif (optionnel)")).toBeInTheDocument();
  });

  it("should render the block button", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    const blockBtn = screen.getByRole("button", { name: "Bloquer" });
    expect(blockBtn).toBeInTheDocument();
    expect(blockBtn).toBeDisabled(); // disabled when no phone number
  });

  it("should enable block button when phone number is entered", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    const input = screen.getByPlaceholderText("+33612345678");
    fireEvent.change(input, { target: { value: "+33612345678" } });

    const blockBtn = screen.getByRole("button", { name: "Bloquer" });
    expect(blockBtn).not.toBeDisabled();
  });

  it("should disable block button during mutation", () => {
    mockBlockMutation.mockImplementation(() => ({
      mutate: vi.fn(),
      isPending: true,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    const input = screen.getByPlaceholderText("+33612345678");
    fireEvent.change(input, { target: { value: "+33612345678" } });

    const blockBtn = screen.getByRole("button", { name: "Bloquer" });
    expect(blockBtn).toBeDisabled();
  });

  it("should call blockMutation.mutate on form submit", () => {
    const mutate = vi.fn();
    mockBlockMutation.mockImplementation(() => ({
      mutate,
      isPending: false,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    fireEvent.change(screen.getByPlaceholderText("+33612345678"), {
      target: { value: "+33612345678" },
    });
    fireEvent.change(screen.getByPlaceholderText("Motif (optionnel)"), {
      target: { value: "Spam" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));

    expect(mutate).toHaveBeenCalledWith({
      phoneNumber: "+33612345678",
      reason: "Spam",
    });
  });

  it("should call blockMutation.mutate without reason when empty", () => {
    const mutate = vi.fn();
    mockBlockMutation.mockImplementation(() => ({
      mutate,
      isPending: false,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    fireEvent.change(screen.getByPlaceholderText("+33612345678"), {
      target: { value: "+33612345678" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Bloquer" }));

    expect(mutate).toHaveBeenCalledWith({
      phoneNumber: "+33612345678",
      reason: undefined,
    });
  });

  it("should not submit when phone number is empty", () => {
    const mutate = vi.fn();
    mockBlockMutation.mockImplementation(() => ({
      mutate,
      isPending: false,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    // submit directly without filling phone number
    const form = document.querySelector("form");
    expect(form).toBeInTheDocument();
    fireEvent.submit(form!);

    expect(mutate).not.toHaveBeenCalled();
  });

  it("should show success toast and refetch on successful block", () => {
    // We need to test the onSuccess callback. Since it's inside the component,
    // we need to capture the callback. Let's make the component use the mock
    // and then call the onSuccess after rendering.
    const refetch = vi.fn();
    mockBlockedQuery.mockReturnValue({ ...buildQueryMock(), refetch });

    // We'll capture the options passed to useMutation
    let capturedOptions: any = null;
    mockBlockMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });

    render(<BlockedNumbersPageClient />);

    // Simulate calling the onSuccess callback
    expect(capturedOptions).not.toBeNull();
    capturedOptions.onSuccess();

    expect(toast).toHaveBeenCalledWith({
      title: "Numéro bloqué",
      variant: "success",
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("should show error toast on failed block", () => {
    let capturedOptions: any = null;
    mockBlockMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    capturedOptions.onError({ message: "Erreur de blocage" });

    expect(toast).toHaveBeenCalledWith({
      title: "Erreur de blocage",
      variant: "destructive",
    });
  });

  it("should show generic error message on failed block without error message", () => {
    let capturedOptions: any = null;
    mockBlockMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    capturedOptions.onError({});

    expect(toast).toHaveBeenCalledWith({
      title: "Erreur lors du blocage",
      variant: "destructive",
    });
  });

  // -----------------------------------------------------------------------
  // Blocked numbers list
  // -----------------------------------------------------------------------

  it("should render blocked numbers with phone number", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText("+33612345678")).toBeInTheDocument();
  });

  it("should render blocked numbers with reason", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText(/Motif : Spam/)).toBeInTheDocument();
  });

  it("should render blocked numbers without reason", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntryNoReason]));

    render(<BlockedNumbersPageClient />);

    expect(screen.queryByText(/Motif :/)).not.toBeInTheDocument();
  });

  it("should render blocked by username", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText(/admin1/)).toBeInTheDocument();
  });

  it("should render 'inconnu' when blockedBy is null", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntryNoBlocker]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByText(/inconnu/)).toBeInTheDocument();
  });

  it("should render unblock button for each entry", () => {
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    const unblockBtns = screen.getAllByRole("button", { name: /Débloquer/i });
    expect(unblockBtns).toHaveLength(1);
  });

  it("should call unblockMutation.mutate on unblock click", () => {
    const mutate = vi.fn();
    mockUnblockMutation.mockImplementation(() => ({
      mutate,
      isPending: false,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Débloquer/i }));

    expect(mutate).toHaveBeenCalledWith({ id: "b-1" });
  });

  it("should disable unblock button during mutation", () => {
    mockUnblockMutation.mockImplementation(() => ({
      mutate: vi.fn(),
      isPending: true,
    }));
    mockBlockedQuery.mockReturnValue(buildQueryMock([sampleBlockedEntry]));

    render(<BlockedNumbersPageClient />);

    expect(screen.getByRole("button", { name: /Débloquer/i })).toBeDisabled();
  });

  it("should show success toast and refetch on successful unblock", () => {
    const refetch = vi.fn();
    mockBlockedQuery.mockReturnValue({ ...buildQueryMock(), refetch });

    let capturedOptions: any = null;
    mockUnblockMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });

    render(<BlockedNumbersPageClient />);

    capturedOptions.onSuccess();

    expect(toast).toHaveBeenCalledWith({
      title: "Numéro débloqué",
      variant: "success",
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("should show error toast on failed unblock", () => {
    let capturedOptions: any = null;
    mockUnblockMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });
    mockBlockedQuery.mockReturnValue(buildQueryMock());

    render(<BlockedNumbersPageClient />);

    capturedOptions.onError({ message: "Erreur de déblocage" });

    expect(toast).toHaveBeenCalledWith({
      title: "Erreur de déblocage",
      variant: "destructive",
    });
  });
});
