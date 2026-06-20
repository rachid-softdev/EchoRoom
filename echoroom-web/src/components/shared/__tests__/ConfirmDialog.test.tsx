import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ConfirmDialog } from "../ConfirmDialog";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onConfirm: vi.fn(),
    onOpenChange: vi.fn(),
    title: "Supprimer ?",
    description: "Êtes-vous sûr ?",
  };

  it("renders with title and description", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText("Supprimer ?")).toBeInTheDocument();
    expect(screen.getByText("Êtes-vous sûr ?")).toBeInTheDocument();
  });

  it("renders default button labels", () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmer" }),
    ).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Oui"
        cancelLabel="Non"
      />,
    );

    expect(screen.getByRole("button", { name: "Oui" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Non" })).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: "Confirmer" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenChange(false) when cancel is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables both buttons when loading", () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    const buttons = screen
      .getAllByRole("button")
      .filter((btn) => btn.getAttribute("aria-label") !== "Fermer");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("disables only confirm button when confirmDisabled is true", () => {
    render(<ConfirmDialog {...defaultProps} confirmDisabled={true} />);

    expect(
      screen.getByRole("button", { name: "Confirmer" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Annuler" }),
    ).not.toBeDisabled();
  });

  it("does not render content when closed", () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);

    // Radix Dialog does not render portal content when open={false}
    expect(screen.queryByText("Supprimer ?")).not.toBeInTheDocument();
  });
});
