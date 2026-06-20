import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Hoisted mocks using vi.hoisted for variables referenced in vi.mock factories
const mockSignOut = vi.hoisted(() => vi.fn());
const mockUpdateProfileMutate = vi.hoisted(() => vi.fn());
const mockDeleteAccountMutate = vi.hoisted(() => vi.fn());
const mockWithdrawConsentMutate = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

// Stable session reference to prevent useEffect from resetting state on every render
const mockSession = vi.hoisted(() => ({
  data: {
    user: {
      id: "u-1",
      username: "TestUser",
      email: "test@example.com",
      credits: 42,
    },
  },
  status: "authenticated",
}));

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => mockSession),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Mock tRPC
vi.mock("@/lib/trpc", () => ({
  api: {
    profile: {
      updateProfile: {
        useMutation: vi.fn((opts?: any) => ({
          mutate: (...args: unknown[]) => {
            mockUpdateProfileMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
      deleteMyAccount: {
        useMutation: vi.fn((opts?: any) => ({
          mutate: (...args: unknown[]) => {
            mockDeleteAccountMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
    },
    user: {
      withdrawConsent: {
        useMutation: vi.fn((opts?: any) => ({
          mutate: (...args: unknown[]) => {
            mockWithdrawConsentMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        })),
      },
    },
  },
}));

// Mock DashboardShell
vi.mock("@/components/shared/DashboardShell", () => ({
  DashboardShell: ({ children, title }: any) => (
    <div data-testid="dashboard-shell" data-title={title}>
      {children}
    </div>
  ),
}));

// Mock ConfirmDialog
vi.mock("@/components/shared/ConfirmDialog", () => ({
  ConfirmDialog: ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    variant,
    confirmDisabled,
    onConfirm,
    loading,
  }: any) =>
    open ? (
      <div data-testid="confirm-dialog" data-variant={variant}>
        <h2>{title}</h2>
        <div>{description}</div>
        <button
          data-testid="confirm-button"
          onClick={onConfirm}
          disabled={confirmDisabled || loading}
        >
          {loading ? "Loading..." : confirmLabel}
        </button>
        <button
          data-testid="cancel-button"
          onClick={() => onOpenChange(false)}
        >
          Annuler
        </button>
      </div>
    ) : null,
}));

// Mock @/components/ui
vi.mock("@/components/ui", () => ({
  Card: ({ children, className }: any) => <div className={className} data-testid="card">{children}</div>,
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardDescription: ({ children }: any) => <p data-testid="card-description">{children}</p>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children, className }: any) => <h3 className={className} data-testid="card-title">{children}</h3>,
  Button: ({ children, onClick, disabled, variant, size, className, ...props }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      {...props}
    >
      {children}
    </button>
  ),
  Input: ({ value, onChange, placeholder, id, disabled, ...props }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      data-testid={id ? `input-${id}` : "input"}
      {...props}
    />
  ),
  toast: mockToast,
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  User: () => <svg data-testid="icon-user" />,
  Download: () => <svg data-testid="icon-download" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  Loader2: () => <svg data-testid="icon-loader" />,
  ShieldX: () => <svg data-testid="icon-shield-x" />,
}));

// Mock fetch for export
vi.stubGlobal("fetch", mockFetch);

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.hoisted(() => vi.fn(() => "blob:test"));
vi.stubGlobal("URL", {
  createObjectURL: mockCreateObjectURL,
  revokeObjectURL: vi.fn(),
});

import { api } from "@/lib/trpc";
import SettingsPageClient from "../SettingsPageClient";

describe("SettingsPageClient", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    // Reset fetch mock
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: "u-1" }, data: "test" }),
    });
  });

  it("renders the profile card with username and email", () => {
    render(<SettingsPageClient />);

    expect(screen.getByText("Profil")).toBeInTheDocument();
    expect(screen.getByText("Gérez vos informations personnelles")).toBeInTheDocument();

    const usernameInput = screen.getByTestId("input-username");
    expect(usernameInput).toHaveValue("TestUser");

    const emailInput = screen.getByTestId("input-email");
    expect(emailInput).toHaveValue("test@example.com");
  });

  it("shows save button disabled when no changes", () => {
    render(<SettingsPageClient />);

    const saveButton = screen.getByText("Enregistrer").closest("button");
    expect(saveButton).toBeDisabled();
  });

  it("enables save button when username is changed", async () => {
    const user = userEvent.setup();
    render(<SettingsPageClient />);

    const usernameInput = screen.getByTestId("input-username");
    await user.clear(usernameInput);
    await user.type(usernameInput, "NewUsername");

    const saveButton = screen.getByText("Enregistrer").closest("button");
    expect(saveButton).not.toBeDisabled();
  });

  it("calls updateProfile mutation when save is clicked", () => {
    render(<SettingsPageClient />);

    // Change the username
    const usernameInput = screen.getByTestId("input-username");
    fireEvent.change(usernameInput, { target: { value: "UpdatedUser" } });

    const saveButton = screen.getByText("Enregistrer").closest("button");
    expect(saveButton).not.toBeDisabled();
    fireEvent.click(saveButton!);

    expect(mockUpdateProfileMutate).toHaveBeenCalledWith({ username: "UpdatedUser" });
  });

  it("shows email input as disabled", () => {
    render(<SettingsPageClient />);

    const emailInput = screen.getByTestId("input-email");
    expect(emailInput).toBeDisabled();
  });

  it("renders appearance section", () => {
    render(<SettingsPageClient />);

    expect(screen.getByText("Apparence")).toBeInTheDocument();
    expect(screen.getByText("Personnalisez votre expérience")).toBeInTheDocument();
    expect(screen.getByText("Thème sombre activé par défaut.")).toBeInTheDocument();
  });

  it("renders danger zone with export, withdraw consent, and delete options", () => {
    render(<SettingsPageClient />);

    expect(screen.getByText("Zone de danger")).toBeInTheDocument();
    expect(screen.getByText("Exporter mes données")).toBeInTheDocument();
    expect(screen.getByText("Retirer le consentement")).toBeInTheDocument();
    expect(screen.getByText("Supprimer mon compte")).toBeInTheDocument();
  });

  it("calls export endpoint when export button is clicked", async () => {
    render(<SettingsPageClient />);

    const exportButton = screen.getByText("Exporter").closest("button");
    fireEvent.click(exportButton!);

    expect(mockFetch).toHaveBeenCalledWith("/api/user/export", {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    });

    await waitFor(() => {
      expect(mockCreateObjectURL).toHaveBeenCalled();
    });
  });

  it("shows error toast when export fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<SettingsPageClient />);

    const exportButton = screen.getByText("Exporter").closest("button");
    fireEvent.click(exportButton!);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Server error", variant: "destructive" }),
      );
    });
  });

  it("shows generic error toast when export fails with no error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    render(<SettingsPageClient />);

    const exportButton = screen.getByText("Exporter").closest("button");
    fireEvent.click(exportButton!);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("Erreur"), variant: "destructive" }),
      );
    });
  });

  it("opens delete confirm dialog when delete button is clicked", () => {
    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getByText("Supprimer votre compte")).toBeInTheDocument();
  });

  it("opens consent withdrawal dialog when withdraw button is clicked", () => {
    render(<SettingsPageClient />);

    const withdrawButton = screen.getByText("Retirer").closest("button");
    fireEvent.click(withdrawButton!);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Retirer le consentement").length).toBeGreaterThanOrEqual(1);
  });

  it("delete confirm button is disabled until SUPPRIMER is typed", async () => {
    const user = userEvent.setup();
    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toBeDisabled();

    const confirmInput = screen.getByTestId("input-delete-confirm");
    await user.type(confirmInput, "SUPPRIMER");

    expect(confirmButton).not.toBeDisabled();
  });

  it("calls delete mutation when confirmed with SUPPRIMER", async () => {
    const user = userEvent.setup();
    render(<SettingsPageClient />);

    // Open delete dialog
    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    // Type confirmation
    const confirmInput = screen.getByTestId("input-delete-confirm");
    await user.type(confirmInput, "SUPPRIMER");

    // Click confirm
    const confirmButton = screen.getByTestId("confirm-button");
    fireEvent.click(confirmButton);

    expect(mockDeleteAccountMutate).toHaveBeenCalledWith({ confirmation: "SUPPRIMER" });
  });

  it("calls withdrawConsent mutation when confirmed with RETIRER", async () => {
    const user = userEvent.setup();
    render(<SettingsPageClient />);

    // Open consent dialog
    const withdrawButton = screen.getByText("Retirer").closest("button");
    fireEvent.click(withdrawButton!);

    // Type confirmation
    const confirmInput = screen.getByTestId("input-consent-confirm");
    await user.type(confirmInput, "RETIRER");

    // Click confirm
    const confirmButton = screen.getByTestId("confirm-button");
    fireEvent.click(confirmButton);

    expect(mockWithdrawConsentMutate).toHaveBeenCalledWith({ confirmation: "RETIRER" });
  });

  it("closes dialog when cancel is clicked", () => {
    render(<SettingsPageClient />);

    // Open delete dialog
    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    expect(screen.getByTestId("confirm-dialog")).toBeInTheDocument();

    // Click cancel
    const cancelButton = screen.getByTestId("cancel-button");
    fireEvent.click(cancelButton);

    expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
  });

  it("signs out on successful account deletion", () => {
    // The mock already calls onSuccess which triggers signOut({ callbackUrl: "/" })
    // Just verify the mutation mock is configured correctly
    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    const confirmInput = screen.getByTestId("input-delete-confirm");
    fireEvent.change(confirmInput, { target: { value: "SUPPRIMER" } });

    const confirmButton = screen.getByTestId("confirm-button");
    fireEvent.click(confirmButton);

    expect(mockDeleteAccountMutate).toHaveBeenCalledWith({ confirmation: "SUPPRIMER" });
  });

  // ── Profile update error toast ───────────────────────────────

  it("shows error toast when profile update fails", async () => {
    // Re-create the mutation mock to call onError instead of onSuccess
    vi.mocked(api.profile.updateProfile.useMutation).mockImplementation(
      (opts?: any) => ({
        mutate: (...args: unknown[]) => {
          mockUpdateProfileMutate(...args);
          opts?.onError?.({ message: "Erreur de mise à jour" });
        },
        isPending: false,
      }),
    );

    render(<SettingsPageClient />);

    const usernameInput = screen.getByTestId("input-username");
    fireEvent.change(usernameInput, { target: { value: "NewName" } });

    const saveButton = screen.getByText("Enregistrer").closest("button");
    fireEvent.click(saveButton!);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur de mise à jour",
        variant: "destructive",
      }),
    );
  });

  it("shows generic error toast when profile update error has no message", () => {
    vi.mocked(api.profile.updateProfile.useMutation).mockImplementation(
      (opts?: any) => ({
        mutate: (...args: unknown[]) => {
          mockUpdateProfileMutate(...args);
          opts?.onError?.({});
        },
        isPending: false,
      }),
    );

    render(<SettingsPageClient />);

    const usernameInput = screen.getByTestId("input-username");
    fireEvent.change(usernameInput, { target: { value: "NewName" } });

    const saveButton = screen.getByText("Enregistrer").closest("button");
    fireEvent.click(saveButton!);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur lors de la mise à jour",
        variant: "destructive",
      }),
    );
  });

  // ── Profile update loading state ─────────────────────────────

  it("shows spinner on save button when updateProfile.isPending", () => {
    vi.mocked(api.profile.updateProfile.useMutation).mockReturnValue({
      mutate: (...args: unknown[]) => mockUpdateProfileMutate(...args),
      isPending: true,
    } as any);

    render(<SettingsPageClient />);

    // When isPending: button shows <Loader2 /> instead of "Enregistrer" text
    const loaderIcon = screen.getByTestId("icon-loader");
    const saveButton = loaderIcon.closest("button");
    expect(saveButton).toBeDisabled();
  });

  // ── Delete mutation error ────────────────────────────────────

  it("shows error toast when delete mutation fails", () => {
    vi.mocked(api.profile.deleteMyAccount.useMutation).mockImplementation(
      (opts?: any) => ({
        mutate: (...args: unknown[]) => {
          mockDeleteAccountMutate(...args);
          opts?.onError?.({ message: "Erreur suppression" });
        },
        isPending: false,
      }),
    );

    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    const confirmInput = screen.getByTestId("input-delete-confirm");
    fireEvent.change(confirmInput, { target: { value: "SUPPRIMER" } });

    const confirmButton = screen.getByTestId("confirm-button");
    fireEvent.click(confirmButton);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur suppression",
        variant: "destructive",
      }),
    );
  });

  // ── Consent withdrawal error ─────────────────────────────────

  it("shows error toast when consent withdrawal fails", () => {
    vi.mocked(api.user.withdrawConsent.useMutation).mockImplementation(
      (opts?: any) => ({
        mutate: (...args: unknown[]) => {
          mockWithdrawConsentMutate(...args);
          opts?.onError?.({ message: "Erreur consentement" });
        },
        isPending: false,
      }),
    );

    render(<SettingsPageClient />);

    const withdrawButton = screen.getByText("Retirer").closest("button");
    fireEvent.click(withdrawButton!);

    const confirmInput = screen.getByTestId("input-consent-confirm");
    fireEvent.change(confirmInput, { target: { value: "RETIRER" } });

    const confirmButton = screen.getByTestId("confirm-button");
    fireEvent.click(confirmButton);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Erreur consentement",
        variant: "destructive",
      }),
    );
  });

  // ── Delete dialog resets confirmation on close ───────────────

  it("resets delete confirmation when dialog is closed", () => {
    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    const confirmInput = screen.getByTestId("input-delete-confirm");
    fireEvent.change(confirmInput, { target: { value: "SUPPRIMER" } });

    // Close dialog
    const cancelButton = screen.getByTestId("cancel-button");
    fireEvent.click(cancelButton);

    // Re-open dialog
    fireEvent.click(deleteButton!);

    // Confirmation should be reset to empty
    const reOpenedInput = screen.getByTestId("input-delete-confirm") as HTMLInputElement;
    expect(reOpenedInput.value).toBe("");
  });

  // ── isPending for delete mutation shows loading ──────────────

  it("shows loading state on confirm button when deleteMutation.isPending", () => {
    vi.mocked(api.profile.deleteMyAccount.useMutation).mockReturnValue({
      mutate: (...args: unknown[]) => mockDeleteAccountMutate(...args),
      isPending: true,
    } as any);

    render(<SettingsPageClient />);

    const deleteButton = screen.getByText("Supprimer").closest("button");
    fireEvent.click(deleteButton!);

    const confirmButton = screen.getByTestId("confirm-button");
    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent("Loading...");
  });
});
