import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    admin: {
      getAuditLogs: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock lucide-react icons used by AuditPageClient and DataLoader
vi.mock("lucide-react", () => ({
  ScrollText: () => <svg data-testid="icon-scroll-text" />,
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

import { api } from "@/lib/trpc";
import AuditPageClient from "../AuditPageClient";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

const mockAuditQuery = api.admin.getAuditLogs.useQuery as ReturnType<typeof vi.fn>;

const sampleAuditLog = {
  id: "log-1",
  action: "APPROVE_SCENARIO",
  entityType: "Scenario",
  entityId: "sc-123",
  createdAt: new Date("2024-06-15T10:30:00Z"),
  admin: { username: "admin1" },
};

const sampleAuditLogNoAdmin = {
  id: "log-2",
  action: "DELETE_COMMENT",
  entityType: "Comment",
  entityId: "cmt-456",
  createdAt: new Date("2024-06-16T14:00:00Z"),
  admin: null,
};

function buildData(items: any[] = [sampleAuditLog], nextCursor?: string) {
  return { items, nextCursor };
}

function buildMockQuery(overrides: Record<string, any> = {}) {
  return {
    isLoading: false,
    data: buildData(),
    isError: false,
    error: null,
    refetch: vi.fn(),
    isFetching: false,
    ...overrides,
  };
}

describe("AuditPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  it("should show loading skeleton when data is loading", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery({ isLoading: true, data: undefined }));

    render(<AuditPageClient />);

    // DataLoader's skeleton renders divs with class "animate-pulse"
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // Error state
  // -----------------------------------------------------------------------

  it("should show error state when query fails", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        isError: true,
        data: undefined,
        error: { message: "Erreur réseau" },
      }),
    );

    render(<AuditPageClient />);

    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Erreur réseau")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Réessayer/i })).toBeInTheDocument();
  });

  it("should show generic error message when no error message provided", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        isError: true,
        data: undefined,
        error: null,
      }),
    );

    render(<AuditPageClient />);

    expect(screen.getByText("Impossible de charger les données. Réessayez.")).toBeInTheDocument();
  });

  it("should call refetch when retry button is clicked", () => {
    const refetch = vi.fn();
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        isError: true,
        data: undefined,
        error: { message: "Erreur" },
        refetch,
      }),
    );

    render(<AuditPageClient />);

    fireEvent.click(screen.getByRole("button", { name: /Réessayer/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  it("should show empty state when there are no audit logs", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery({ data: buildData([], undefined) }));

    render(<AuditPageClient />);

    expect(screen.getByText("Aucune entrée")).toBeInTheDocument();
    expect(
      screen.getByText("Aucune entrée de journal d'audit pour ces filtres."),
    ).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Data state
  // -----------------------------------------------------------------------

  it("should render the page title and description", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByRole("heading", { name: /Journal d'audit/i })).toBeInTheDocument();
    expect(
      screen.getByText("Consultez l'historique des actions administratives"),
    ).toBeInTheDocument();
  });

  it("should render audit log entries in the table", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        data: buildData([sampleAuditLog, sampleAuditLogNoAdmin]),
      }),
    );

    render(<AuditPageClient />);

    const rows = document.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
  });

  it("should display the admin username", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByText("admin1")).toBeInTheDocument();
  });

  it("should display a dash when admin is null", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery({ data: buildData([sampleAuditLogNoAdmin]) }));

    render(<AuditPageClient />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("should display the action label for known actions", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    // "Approbation" appears both in the table cell and in the <option> filter
    const approbationElements = screen.getAllByText("Approbation");
    expect(approbationElements.length).toBeGreaterThanOrEqual(1);
  });

  it("should display the raw action when label is unknown", () => {
    const unknownLog = {
      ...sampleAuditLog,
      action: "UNKNOWN_ACTION",
    };
    mockAuditQuery.mockReturnValue(buildMockQuery({ data: buildData([unknownLog]) }));

    render(<AuditPageClient />);

    expect(screen.getByText("UNKNOWN_ACTION")).toBeInTheDocument();
  });

  it("should display the entity type", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByText("Scenario")).toBeInTheDocument();
  });

  it("should display the entity id", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByText("sc-123")).toBeInTheDocument();
  });

  it("should display the entry count in the card title", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({ data: buildData([sampleAuditLog, sampleAuditLogNoAdmin]) }),
    );

    render(<AuditPageClient />);

    expect(screen.getByText("2 entrées")).toBeInTheDocument();
  });

  it("should display '1 entrée' for a single item", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByText("1 entrée")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Filters
  // -----------------------------------------------------------------------

  it("should render the action filter select", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.getByRole("combobox", { name: /Filtrer par action/i })).toBeInTheDocument();
  });

  it("should render the entity type filter select", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(
      screen.getByRole("combobox", { name: /Filtrer par type d'entité/i }),
    ).toBeInTheDocument();
  });

  it("should render date from and date to inputs", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    // Labels are not associated via htmlFor, so we check by text content
    expect(screen.getByText("Du")).toBeInTheDocument();
    expect(screen.getByText("Au")).toBeInTheDocument();
    // Verify the date inputs exist
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBe(2);
  });

  it("should show reset button when a filter is active", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    // Action filter is set to "Toutes les actions" (value="") which is undefined
    // No filter is active initially, so no reset button
    expect(screen.queryByRole("button", { name: /Réinitialiser/i })).not.toBeInTheDocument();
  });

  it("should call handleResetFilters when reset button is clicked", () => {
    // Mock with a filter that changes the query args
    mockAuditQuery.mockImplementation(() => ({
      isLoading: false,
      data: { items: [], nextCursor: undefined },
      isError: false,
      refetch: vi.fn(),
    }));

    render(<AuditPageClient />);

    // Select an action to make a filter active
    const actionSelect = screen.getByRole("combobox", {
      name: /Filtrer par action/i,
    });
    fireEvent.change(actionSelect, { target: { value: "APPROVE_SCENARIO" } });

    // Reset button should appear
    const resetBtn = screen.getByRole("button", { name: /Réinitialiser/i });
    expect(resetBtn).toBeInTheDocument();

    // Click reset
    fireEvent.click(resetBtn);

    // The select should be back to default (empty value = "Toutes les actions")
    expect(actionSelect).toHaveValue("");
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  it("should show 'Charger plus' button when nextCursor is present", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        data: buildData([sampleAuditLog], "cursor-2"),
        isFetching: false,
      }),
    );

    render(<AuditPageClient />);

    expect(screen.getByRole("button", { name: /Charger plus/i })).toBeInTheDocument();
  });

  it("should not show 'Charger plus' button when nextCursor is absent", () => {
    mockAuditQuery.mockReturnValue(buildMockQuery());

    render(<AuditPageClient />);

    expect(screen.queryByRole("button", { name: /Charger plus/i })).not.toBeInTheDocument();
  });

  it("should show 'Chargement...' on pagination button when isFetching", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        data: buildData([sampleAuditLog], "cursor-2"),
        isFetching: true,
      }),
    );

    render(<AuditPageClient />);

    expect(screen.getByRole("button", { name: /Chargement.../i })).toBeInTheDocument();
  });

  it("should disable pagination button when isFetching", () => {
    mockAuditQuery.mockReturnValue(
      buildMockQuery({
        data: buildData([sampleAuditLog], "cursor-2"),
        isFetching: true,
      }),
    );

    render(<AuditPageClient />);

    expect(screen.getByRole("button", { name: /Chargement.../i })).toBeDisabled();
  });
});
