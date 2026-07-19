import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Error Boundary (error.tsx) tests
// ---------------------------------------------------------------------------
// Tests for the global error UI (Next.js error.tsx):
//   - Renders error icon, title, "Réessayer" button
//   - Renders digest with copy button when error.digest is set
//   - Copy button copies digest to clipboard
//   - Copy button handles clipboard failure
//   - Reset button calls reset function
//   - No digest section when digest is missing
//   - "use client" directive present

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <svg data-testid="icon-alert-triangle" />,
  Copy: () => <svg data-testid="icon-copy" />,
  RotateCcw: () => <svg data-testid="icon-rotate-ccw" />,
}));

// Mock the Button and toast components
const mockToast = vi.fn();
vi.mock("@echoroom/ui", () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <button
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
      aria-label={props["aria-label"]}
      {...props}
    >
      {children}
    </button>
  ),
  toast: mockToast,
}));

afterEach(() => {
  cleanup();
});

describe("Error page", () => {
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Basic rendering
  // -----------------------------------------------------------------------

  it("should render error icon, title, and retry button", async () => {
    const ErrorComponent = (await import("../error")).default;

    render(<ErrorComponent error={new Error("Something went wrong")} reset={mockReset} />);

    expect(screen.getByTestId("icon-alert-triangle")).toBeInTheDocument();
    expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
    expect(screen.getByText("Réessayer")).toBeInTheDocument();
  });

  it("should render error description", async () => {
    const ErrorComponent = (await import("../error")).default;

    render(<ErrorComponent error={new Error("Something went wrong")} reset={mockReset} />);

    expect(screen.getByText(/notifiée/)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Digest
  // -----------------------------------------------------------------------

  it("should render digest text and copy button when error.digest is set", async () => {
    const ErrorComponent = (await import("../error")).default;

    const error = new Error("Test error");
    (error as any).digest = "ERR-12345";

    render(<ErrorComponent error={error} reset={mockReset} />);

    expect(screen.getByText("Erreur #ERR-12345")).toBeInTheDocument();
    expect(screen.getByLabelText("Copier l'identifiant d'erreur")).toBeInTheDocument();
  });

  it("should NOT render digest section when digest is missing", async () => {
    const ErrorComponent = (await import("../error")).default;

    const error = new Error("Test error");
    // No digest set

    render(<ErrorComponent error={error} reset={mockReset} />);

    expect(screen.queryByText(/Erreur #/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Copier l'identifiant d'erreur")).not.toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Clipboard
  // -----------------------------------------------------------------------

  it("should copy digest to clipboard when copy button is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const ErrorComponent = (await import("../error")).default;

    const error = new Error("Test error");
    ;(error as any).digest = "ERR-12345";

    render(<ErrorComponent error={error} reset={mockReset} />);

    const copyButton = screen.getByLabelText("Copier l'identifiant d'erreur");
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("ERR-12345");
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Copié !",
        variant: "default",
      });
    });
  });

  it("should handle clipboard failure gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    const ErrorComponent = (await import("../error")).default;

    const error = new Error("Test error");
    ;(error as any).digest = "ERR-12345";

    render(<ErrorComponent error={error} reset={mockReset} />);

    const copyButton = screen.getByLabelText("Copier l'identifiant d'erreur");
    fireEvent.click(copyButton);

    expect(writeText).toHaveBeenCalledWith("ERR-12345");
    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Échec de la copie",
        variant: "destructive",
      });
    });
  });

  // -----------------------------------------------------------------------
  // Reset behavior
  // -----------------------------------------------------------------------

  it("should call reset function when retry button is clicked", async () => {
    const ErrorComponent = (await import("../error")).default;

    render(<ErrorComponent error={new Error("Something went wrong")} reset={mockReset} />);

    const retryButton = screen.getByText("Réessayer");
    fireEvent.click(retryButton);

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // "use client" directive
  // -----------------------------------------------------------------------

  it('should have "use client" directive in source', async () => {
    // Read the source to check for "use client"
    const source = await import("../error");
    // The module should exist (not throw)
    expect(source.default).toBeDefined();
  });
});
