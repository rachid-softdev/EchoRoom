import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    admin: {
      getAbuseReports: {
        useQuery: vi.fn(),
      },
      dismissAbuseReport: {
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

// Mock lucide-react icons used by ReportsPageClient and DataLoader
vi.mock("lucide-react", () => ({
  Flag: () => <svg data-testid="icon-flag" />,
  Check: () => <svg data-testid="icon-check" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

import { toast } from "@/components/ui";
import { api } from "@/lib/trpc";
import ReportsPageClient from "../ReportsPageClient";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const mockReportsQuery = api.admin.getAbuseReports.useQuery as ReturnType<typeof vi.fn>;
const mockDismissMutation = api.admin.dismissAbuseReport.useMutation as ReturnType<typeof vi.fn>;

const samplePendingReport = {
  id: "r-1",
  targetType: "SCENARIO",
  status: "PENDING",
  reason: "Contenu inapproprié",
  createdAt: new Date("2024-06-15"),
  reporter: { username: "user1" },
  reviewedBy: null,
};

const sampleReviewedReport = {
  id: "r-2",
  targetType: "COMMENT",
  status: "REVIEWED",
  reason: "Spam dans les commentaires",
  createdAt: new Date("2024-06-16"),
  reporter: { username: "user2" },
  reviewedBy: { username: "admin1" },
};

const sampleDismissedReport = {
  id: "r-3",
  targetType: "USER",
  status: "DISMISSED",
  reason: "Fausse alerte",
  createdAt: new Date("2024-06-17"),
  reporter: { username: "user3" },
  reviewedBy: null,
};

const sampleLongReasonReport = {
  id: "r-4",
  targetType: "SCENARIO",
  status: "PENDING",
  reason: "a".repeat(150),
  createdAt: new Date("2024-06-18"),
  reporter: { username: "user4" },
  reviewedBy: null,
};

function createMutationMock() {
  const mutate = vi.fn();
  return vi.fn(() => ({
    mutate,
    isPending: false,
  }));
}

function buildQueryMock(items: any[] = [samplePendingReport]) {
  return {
    isLoading: false,
    data: { items },
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("ReportsPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDismissMutation.mockImplementation(createMutationMock());
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it("should show loading skeleton when data is loading", () => {
    mockReportsQuery.mockReturnValue({
      isLoading: true,
      data: undefined,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ReportsPageClient />);

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it("should show error state when query fails", () => {
    mockReportsQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur de chargement" },
      refetch: vi.fn(),
    });

    render(<ReportsPageClient />);

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument();
  });

  it("should call refetch when retry button is clicked", () => {
    const refetch = vi.fn();
    mockReportsQuery.mockReturnValue({
      isLoading: false,
      data: undefined,
      isError: true,
      error: { message: "Erreur" },
      refetch,
    });

    render(<ReportsPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("should show empty state when no reports", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([]));

    render(<ReportsPageClient />);

    expect(screen.getByText("Aucun signalement")).toBeInTheDocument();
    expect(screen.getByText("Aucun signalement à afficher pour ce filtre.")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Page layout
  // -----------------------------------------------------------------------

  it("should render the page title and description", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock());

    render(<ReportsPageClient />);

    expect(screen.getByRole("heading", { name: "Signalements" })).toBeInTheDocument();
    expect(screen.getByText("Gérez les signalements de contenu abusif")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Status filter buttons
  // -----------------------------------------------------------------------

  it("should render status filter buttons", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock());

    render(<ReportsPageClient />);

    expect(screen.getByRole("button", { name: "Tous" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "En attente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Traité" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ignoré" })).toBeInTheDocument();
  });

  it("should highlight the active status filter", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock());

    render(<ReportsPageClient />);

    // "Tous" is the default active filter (highlighted)
    const tousBtn = screen.getByRole("button", { name: "Tous" });
    expect(tousBtn).toHaveClass("bg-primary");
  });

  it("should change active filter when clicked", () => {
    mockReportsQuery.mockImplementation(() => ({
      isLoading: false,
      data: { items: [] },
      isError: false,
      refetch: vi.fn(),
    }));

    render(<ReportsPageClient />);

    fireEvent.click(screen.getByRole("button", { name: "En attente" }));
    expect(screen.getByRole("button", { name: "En attente" })).toHaveClass("bg-primary");
  });

  // -----------------------------------------------------------------------
  // Data rendering
  // -----------------------------------------------------------------------

  it("should render the target type label", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText("Scénario")).toBeInTheDocument();
  });

  it("should render the fallback target type when label is unknown", () => {
    const unknownTargetReport = {
      ...samplePendingReport,
      targetType: "UNKNOWN",
    };
    mockReportsQuery.mockReturnValue(buildQueryMock([unknownTargetReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("should render the status badge label", () => {
    mockReportsQuery.mockReturnValue(
      buildQueryMock([samplePendingReport, sampleReviewedReport, sampleDismissedReport]),
    );

    render(<ReportsPageClient />);

    // These appear both in filter buttons and status badges
    expect(screen.getAllByText("En attente").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Traité").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ignoré").length).toBeGreaterThanOrEqual(1);
  });

  it("should render the reporter username", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText(/user1/)).toBeInTheDocument();
  });

  it("should render 'inconnu' when reporter is null", () => {
    const reportNoReporter = {
      ...samplePendingReport,
      reporter: null,
    };
    mockReportsQuery.mockReturnValue(buildQueryMock([reportNoReporter]));

    render(<ReportsPageClient />);

    expect(screen.getByText(/inconnu/)).toBeInTheDocument();
  });

  it("should render the reason text", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText("Contenu inapproprié")).toBeInTheDocument();
  });

  it("should truncate long reasons", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([sampleLongReasonReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Reviewed by
  // -----------------------------------------------------------------------

  it("should show reviewed by when available", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([sampleReviewedReport]));

    render(<ReportsPageClient />);

    expect(screen.getByText("Reviewé par admin1")).toBeInTheDocument();
  });

  it("should not show reviewed by when absent", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.queryByText(/Reviewé par/)).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Dismiss action
  // -----------------------------------------------------------------------

  it("should show dismiss button for PENDING reports", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.getByRole("button", { name: /Ignorer/i })).toBeInTheDocument();
  });

  it("should not show dismiss button for non-PENDING reports", () => {
    mockReportsQuery.mockReturnValue(buildQueryMock([sampleReviewedReport, sampleDismissedReport]));

    render(<ReportsPageClient />);

    expect(screen.queryByRole("button", { name: /Ignorer/i })).not.toBeInTheDocument();
  });

  it("should call dismissMutation.mutate on dismiss click", () => {
    const mutate = vi.fn();
    mockDismissMutation.mockImplementation(() => ({
      mutate,
      isPending: false,
    }));
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Ignorer/i }));

    expect(mutate).toHaveBeenCalledWith({ reportId: "r-1" });
  });

  it("should disable dismiss button during mutation", () => {
    mockDismissMutation.mockImplementation(() => ({
      mutate: vi.fn(),
      isPending: true,
    }));
    mockReportsQuery.mockReturnValue(buildQueryMock([samplePendingReport]));

    render(<ReportsPageClient />);

    expect(screen.getByRole("button", { name: /Ignorer/i })).toBeDisabled();
  });

  it("should show success toast on successful dismiss", () => {
    const refetch = vi.fn();
    mockReportsQuery.mockReturnValue({ ...buildQueryMock(), refetch });

    let capturedOptions: any = null;
    mockDismissMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });

    render(<ReportsPageClient />);

    capturedOptions.onSuccess();

    expect(toast).toHaveBeenCalledWith({
      title: "Signalement ignoré",
      variant: "success",
    });
    expect(refetch).toHaveBeenCalled();
  });

  it("should show error toast on failed dismiss", () => {
    let capturedOptions: any = null;
    mockDismissMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });
    mockReportsQuery.mockReturnValue(buildQueryMock());

    render(<ReportsPageClient />);

    capturedOptions.onError({ message: "Erreur de traitement" });

    expect(toast).toHaveBeenCalledWith({
      title: "Erreur de traitement",
      variant: "destructive",
    });
  });

  it("should show generic error title when no error message", () => {
    let capturedOptions: any = null;
    mockDismissMutation.mockImplementation((opts?: any) => {
      capturedOptions = opts;
      return { mutate: vi.fn(), isPending: false };
    });
    mockReportsQuery.mockReturnValue(buildQueryMock());

    render(<ReportsPageClient />);

    capturedOptions.onError({});

    expect(toast).toHaveBeenCalledWith({
      title: "Erreur",
      variant: "destructive",
    });
  });
});
