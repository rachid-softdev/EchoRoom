import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { BadgeNotification } from "../BadgeNotification";

const mockBadge = {
  id: "b-1",
  name: "Veteran",
  iconUrl: null,
  description: "Made 100 calls",
  awardedAt: new Date(),
};

describe("BadgeNotification", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns null when badge prop is null", () => {
    const { container } = render(
      <BadgeNotification badge={null} onClose={vi.fn()} />,
    );

    expect(container.innerHTML).toBe("");
  });

  it("shows notification when badge is provided", () => {
    render(<BadgeNotification badge={mockBadge} onClose={vi.fn()} />);

    expect(screen.getByText("Veteran")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("calls onClose after 5 seconds", () => {
    const onClose = vi.fn();
    render(<BadgeNotification badge={mockBadge} onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    render(<BadgeNotification badge={mockBadge} onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: /fermer/i });
    act(() => {
      closeBtn.click();
      vi.advanceTimersByTime(250);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clears timer on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <BadgeNotification badge={mockBadge} onClose={onClose} />,
    );

    unmount();

    // Advance time to ensure no late callback
    act(() => {
      vi.advanceTimersByTime(5200);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
