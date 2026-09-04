import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../atoms/button";
import { ConfirmDialog } from "../organisms/ConfirmDialog";

afterEach(() => cleanup());

describe("ConfirmDialog", () => {
  it("stays closed until the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Ouvrir</Button>}
        title="Supprimer ?"
        description="Confirmer la suppression"
      />,
    );
    expect(screen.queryByText("Supprimer ?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    expect(screen.getByText("Supprimer ?")).toBeInTheDocument();
    expect(screen.getByText("Confirmer la suppression")).toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="Delete"
        confirmLabel="Yes"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders a destructive confirm button variant", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        trigger={<Button>Open</Button>}
        title="X"
        variant="destructive"
        confirmLabel="Delete"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("bg-destructive");
  });
});
