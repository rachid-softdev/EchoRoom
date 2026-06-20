import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ToastProvider,
  Toaster,
  useToast,
  toast,
  Toast,
} from "../toast";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: component that uses useToast to programmatically add toasts
// ---------------------------------------------------------------------------

function ToastAdder({
  message = "Test toast",
  variant = "default" as const,
  duration = 4000,
}: {
  message?: string;
  variant?: "default" | "destructive" | "success";
  duration?: number;
}) {
  const { addToast, removeToast, toasts } = useToast();
  return (
    <div>
      <button
        data-testid="add-toast"
        onClick={() => addToast({ message, variant, duration })}
      >
        Add Toast
      </button>
      <button
        data-testid="remove-first"
        onClick={() => {
          if (toasts.length > 0) removeToast(toasts[0].id);
        }}
      >
        Remove First
      </button>
      <span data-testid="toast-count">{toasts.length}</span>
    </div>
  );
}

function ToastConsumer() {
  const { toasts } = useToast();
  return <div data-testid="consumer-toasts">{toasts.length}</div>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ToastProvider", () => {
  it("renders children", () => {
    render(
      <ToastProvider>
        <div data-testid="child">Child content</div>
      </ToastProvider>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("addToast adds a toast that appears in Toaster", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastAdder message="Hello world" />
        <Toaster />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-toast"));

    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("removeToast removes a toast", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastAdder message="Removable toast" />
        <Toaster />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-toast"));
    expect(screen.getByText("Removable toast")).toBeInTheDocument();

    await user.click(screen.getByTestId("remove-first"));

    expect(screen.queryByText("Removable toast")).not.toBeInTheDocument();
  });

  it("useToast throws error when used outside Toaster", () => {
    // Suppress console.error for expected errors
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<ToastConsumer />)).toThrow(
      "useToast must be used within <Toaster>",
    );

    consoleSpy.mockRestore();
  });

  it.skip("auto-dismisses toast after duration", async () => {
    vi.useFakeTimers();

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <ToastProvider>
        <ToastAdder message="Auto dismiss" duration={100} />
        <Toaster />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-toast"));
    expect(screen.getByText("Auto dismiss")).toBeInTheDocument();

    // Advance time past duration
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(screen.queryByText("Auto dismiss")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  // ── Toast with close button ──────────────────────────────────────

  it("Toast with close button renders and works", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Toast
        message="Closable toast"
        onClose={onClose}
      />,
    );

    expect(screen.getByText("Closable toast")).toBeInTheDocument();
    expect(screen.getByText("Fermer")).toBeInTheDocument();

    const closeButton = screen.getByRole("button", { name: /fermer/i });
    await user.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Toast without close button has no close button", () => {
    render(<Toast message="No close" />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // ── Standalone toast() ────────────────────────────────────────────

  it("standalone toast() dispatches CustomEvent", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    const eventListener = vi.fn();
    window.addEventListener("echoroom-toast", eventListener);

    toast("Standalone message");

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe("echoroom-toast");
    expect(event.detail.message).toBe("Standalone message");
    expect(event.detail.variant).toBe("default");
    expect(event.detail.duration).toBe(4000);

    window.removeEventListener("echoroom-toast", eventListener);
    dispatchSpy.mockRestore();
  });

  it("standalone toast with options object dispatches correct detail", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    toast({
      title: "Title message",
      variant: "destructive",
      duration: 2000,
    });

    const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.message).toBe("Title message");
    expect(event.detail.variant).toBe("destructive");
    expect(event.detail.duration).toBe(2000);

    dispatchSpy.mockRestore();
  });

  it("standalone toast triggers actual toast in Toaster", () => {
    render(
      <ToastProvider>
        <Toaster />
      </ToastProvider>,
    );

    // The toast event listener is set up in ToastProvider
    act(() => {
      toast("Event toast", "success", 1000);
    });

    expect(screen.getByText("Event toast")).toBeInTheDocument();
  });

  // ── Toast variant styling ─────────────────────────────────────────

  it("renders default variant with correct classes", () => {
    const { container } = render(<Toast message="Default" variant="default" />);
    const toastEl = container.firstChild as HTMLElement;
    expect(toastEl.className).toContain("bg-card");
    expect(toastEl.className).toContain("text-card-foreground");
  });

  it("renders destructive variant with correct classes", () => {
    const { container } = render(
      <Toast message="Destructive" variant="destructive" />,
    );
    const toastEl = container.firstChild as HTMLElement;
    expect(toastEl.className).toContain("bg-destructive");
    expect(toastEl.className).toContain("text-destructive-foreground");
  });

  it("renders success variant with correct classes", () => {
    const { container } = render(
      <Toast message="Success" variant="success" />,
    );
    const toastEl = container.firstChild as HTMLElement;
    expect(toastEl.className).toContain("bg-primary/10");
    expect(toastEl.className).toContain("text-primary");
  });

  // ── Multiple toasts ───────────────────────────────────────────────

  it("stacks multiple toasts", async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastAdder message="Toast 1" />
        <Toaster />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-toast"));
    await user.click(screen.getByTestId("add-toast"));
    await user.click(screen.getByTestId("add-toast"));

    expect(screen.getAllByText(/Toast \d/)).toHaveLength(3);
  });

  // ── Close button ──────────────────────────────────────────────────

  it("close button has sr-only 'Fermer' text", () => {
    render(
      <Toast message="Test" onClose={vi.fn()} />,
    );

    const closeButton = screen.getByRole("button", { name: /fermer/i });
    expect(closeButton).toBeInTheDocument();
    // sr-only span should contain "Fermer"
    const srSpan = closeButton.querySelector(".sr-only");
    expect(srSpan).toBeInTheDocument();
    expect(srSpan).toHaveTextContent("Fermer");
  });

  // ── Fixed positioning ─────────────────────────────────────────────

  it("Toaster has fixed positioning with z-[100]", () => {
    render(
      <ToastProvider>
        <Toaster />
      </ToastProvider>,
    );

    const toasterDiv = document.querySelector(".fixed.bottom-4.right-4");
    expect(toasterDiv).toBeInTheDocument();
    expect(toasterDiv?.className).toContain("z-[100]");
  });
});
