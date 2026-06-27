import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../dialog";

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Mock useFocusTrap — it uses requestAnimationFrame which can be flaky in jsdom
// ---------------------------------------------------------------------------

vi.mock("@/hooks/useFocusTrap", () => ({
  useFocusTrap: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Dialog", () => {
  // ── Opening ───────────────────────────────────────────────────────

  it("opens when trigger is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open Dialog</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog Title</DialogTitle>
          <p>Dialog content here</p>
        </DialogContent>
      </Dialog>,
    );

    // Dialog should not be visible initially
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Dialog Title")).not.toBeInTheDocument();

    // Click trigger
    await user.click(screen.getByText("Open Dialog"));

    // Dialog should now be visible
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
    expect(screen.getByText("Dialog content here")).toBeInTheDocument();
  });

  // ── Closing via Escape ────────────────────────────────────────────

  it("closes when Escape is pressed", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal</DialogTitle>
          <p>Press Escape to close</p>
        </DialogContent>
      </Dialog>,
    );

    // Open the dialog
    await user.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Press Escape
    await user.keyboard("{Escape}");

    // Dialog should close
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Modal")).not.toBeInTheDocument();
  });

  // ── Closing via backdrop click ────────────────────────────────────

  it("closes when backdrop is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal</DialogTitle>
          <p>Click backdrop to close</p>
        </DialogContent>
      </Dialog>,
    );

    // Open the dialog
    await user.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click the backdrop (the first child with fixed inset-0 bg-black/60)
    const backdrop = document.querySelector(".fixed.inset-0.bg-black\\/60");
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);

    // Dialog should close
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── Closing via X button ──────────────────────────────────────────

  it("closes when close button (X) is clicked", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Modal</DialogTitle>
          <p>Click X to close</p>
        </DialogContent>
      </Dialog>,
    );

    // Open the dialog
    await user.click(screen.getByText("Open"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click the close button (X icon button with aria-label "Fermer")
    const closeButton = screen.getByRole("button", { name: /fermer/i });
    await user.click(closeButton);

    // Dialog should close
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  // ── Controlled open/close ─────────────────────────────────────────

  it("renders content when open prop is true", () => {
    render(
      <Dialog open={true}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Controlled Dialog")).toBeInTheDocument();
  });

  it("does not render content when open prop is false", () => {
    render(
      <Dialog open={false}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Controlled Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("calls onOpenChange when closing", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Dialog open={true} onOpenChange={onOpenChange}>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    // Press Escape
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // ── Content rendering ─────────────────────────────────────────────

  it("renders header, footer, title, and description", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Dialog</DialogTitle>
            <DialogDescription>This is a description of the dialog.</DialogDescription>
          </DialogHeader>
          <div>Main content area</div>
          <DialogFooter>
            <button type="button">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByText("Open"));

    expect(screen.getByText("Complete Dialog")).toBeInTheDocument();
    expect(screen.getByText("This is a description of the dialog.")).toBeInTheDocument();
    expect(screen.getByText("Main content area")).toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  // ── asChild prop on DialogTrigger ─────────────────────────────────

  it("renders trigger as a child element when asChild is true", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger asChild>
          <span data-testid="custom-trigger">Custom Trigger</span>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>asChild Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    // The trigger should render as a <span>, not a <button>
    const trigger = screen.getByTestId("custom-trigger");
    expect(trigger.tagName).toBe("SPAN");
    expect(trigger).toHaveTextContent("Custom Trigger");

    // There should be NO <button> rendered as the trigger when asChild is used
    // (because asChild uses Slot which renders the child directly)
    expect(screen.queryByText("Open")).not.toBeInTheDocument();

    // Click the custom trigger to open dialog
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("asChild Dialog")).toBeInTheDocument();
  });

  it("does not create nested buttons when asChild is used with a button", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button" data-testid="inner-button">
            Inner Button
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Nested Button Check</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    const innerButton = screen.getByTestId("inner-button");
    expect(innerButton).toBeInTheDocument();
    expect(innerButton.tagName).toBe("BUTTON");

    // Click should still open the dialog
    await user.click(innerButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  // ── Initial closed state ──────────────────────────────────────────

  it("does NOT render dialog content initially", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Secret Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Secret Dialog")).not.toBeInTheDocument();
  });

  it("has aria-modal and role=dialog on content", async () => {
    const user = userEvent.setup();

    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Accessible Dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByText("Open"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });
});
