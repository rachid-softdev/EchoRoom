import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests — Avatar
// ---------------------------------------------------------------------------

describe("Avatar", () => {
  it("renders as a div with rounded-full class", () => {
    const { container } = render(<Avatar />);

    const avatar = container.firstChild as HTMLElement;
    expect(avatar.tagName).toBe("DIV");
    expect(avatar.className).toContain("rounded-full");
    expect(avatar.className).toContain("h-10");
    expect(avatar.className).toContain("w-10");
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<Avatar className="custom-class" />);

    const avatar = container.firstChild as HTMLElement;
    expect(avatar.className).toContain("custom-class");
  });

  it("renders children inside the div", () => {
    render(
      <Avatar>
        <span data-testid="child">Content</span>
      </Avatar>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("forwards ref to the div element", () => {
    const ref = { current: null as HTMLDivElement | null };

    const { container } = render(<Avatar ref={ref} />);
    expect(ref.current).toBe(container.firstChild);
  });

  it("passes extra props to the div element", () => {
    render(<Avatar data-testid="avatar-root" />);

    expect(screen.getByTestId("avatar-root")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — AvatarImage
// ---------------------------------------------------------------------------

describe("AvatarImage", () => {
  it("renders an img element with lazy loading", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
      </Avatar>,
    );

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(img).toHaveAttribute("alt", "User");
    expect(img).toHaveAttribute("loading", "lazy");
  });

  it("has default alt as empty string when not provided", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" />
      </Avatar>,
    );

    // img with alt="" has role="presentation", use querySelector
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "");
  });

  it("applies custom className to the image", () => {
    const { container } = render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" className="custom-img" />
      </Avatar>,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.className).toContain("custom-img");
  });

  it("is hidden initially (status is 'loading'), then shows on load", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
      </Avatar>,
    );

    const img = screen.getByRole("img");
    // Initially status is 'loading' → class should contain 'hidden'
    expect(img.className).toContain("hidden");

    // Trigger onLoad
    act(() => {
      fireEvent.load(img);
    });

    // After load, class should not contain 'hidden' and should contain 'block'
    expect(img.className).not.toContain("hidden");
    expect(img.className).toContain("block");

    // Should also have aspect-square, h-full, w-full, object-cover
    expect(img.className).toContain("aspect-square");
    expect(img.className).toContain("object-cover");
  });

  it("stays hidden on error", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
      </Avatar>,
    );

    const img = screen.getByRole("img");
    expect(img.className).toContain("hidden");

    // Trigger onError
    act(() => {
      fireEvent.error(img);
    });

    // Still hidden after error
    expect(img.className).toContain("hidden");
    expect(img.className).not.toContain("block");
  });

  it("calls onLoadingStatusChange when status changes", () => {
    const onLoadingStatusChange = vi.fn();

    const { container } = render(
      <Avatar>
        <AvatarImage
          src="https://example.com/avatar.png"
          onLoadingStatusChange={onLoadingStatusChange}
        />
      </Avatar>,
    );

    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeInTheDocument();

    // Initial mount: status is "loading"
    expect(onLoadingStatusChange).toHaveBeenCalledWith("loading");

    onLoadingStatusChange.mockClear();

    // Trigger onLoad
    act(() => {
      fireEvent.load(img);
    });

    expect(onLoadingStatusChange).toHaveBeenCalledWith("loaded");
  });

  it("forwards ref to the img element", () => {
    const ref = { current: null as HTMLImageElement | null };

    render(
      <Avatar>
        <AvatarImage ref={ref} src="https://example.com/avatar.png" alt="Ref" />
      </Avatar>,
    );

    expect(ref.current).toBe(screen.getByRole("img"));
  });
});

// ---------------------------------------------------------------------------
// Tests — AvatarFallback
// ---------------------------------------------------------------------------

describe("AvatarFallback", () => {
  it("does not render initially (show is false)", () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );

    expect(screen.queryByText("JD")).not.toBeInTheDocument();
  });

  it("renders after the default delay (100ms from context)", () => {
    render(
      <Avatar>
        <AvatarFallback>JD</AvatarFallback>
      </Avatar>,
    );

    // Before delay — not visible
    expect(screen.queryByText("JD")).not.toBeInTheDocument();

    // Advance past the default delay
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("uses custom delay prop instead of context value", () => {
    render(
      <Avatar fallbackDelay={500}>
        <AvatarFallback delay={200}>AB</AvatarFallback>
      </Avatar>,
    );

    // Before 200ms — not visible
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByText("AB")).not.toBeInTheDocument();

    // At 200ms — visible
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("uses fallbackDelay from Avatar context when no delay prop", () => {
    render(
      <Avatar fallbackDelay={300}>
        <AvatarFallback>CD</AvatarFallback>
      </Avatar>,
    );

    // Before 300ms — not visible
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText("CD")).not.toBeInTheDocument();

    // At 300ms — visible
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByText("CD")).toBeInTheDocument();
  });

  it("renders as a div with background and text classes", () => {
    render(
      <Avatar>
        <AvatarFallback>EF</AvatarFallback>
      </Avatar>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const fallback = screen.getByText("EF");
    expect(fallback.tagName).toBe("DIV");
    expect(fallback.className).toContain("bg-muted");
    expect(fallback.className).toContain("text-muted-foreground");
    expect(fallback.className).toContain("rounded-full");
  });

  it("applies custom className to the fallback div", () => {
    render(
      <Avatar>
        <AvatarFallback className="custom-fallback">GH</AvatarFallback>
      </Avatar>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const fallback = screen.getByText("GH");
    expect(fallback.className).toContain("custom-fallback");
  });

  it("clears timer on unmount", () => {
    const { unmount } = render(
      <Avatar>
        <AvatarFallback>IJ</AvatarFallback>
      </Avatar>,
    );

    unmount();

    // Even after delay, should not appear since component is unmounted
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText("IJ")).not.toBeInTheDocument();
  });

  it("renders children text content", () => {
    render(
      <Avatar>
        <AvatarFallback>KL</AvatarFallback>
      </Avatar>,
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("KL")).toBeInTheDocument();
  });

  it("works with AvatarImage (integration)", () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="User" />
        <AvatarFallback>MN</AvatarFallback>
      </Avatar>,
    );

    // Image is present but hidden
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();

    // Fallback not visible yet
    expect(screen.queryByText("MN")).not.toBeInTheDocument();

    // After delay, fallback shows
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText("MN")).toBeInTheDocument();

    // Load the image
    act(() => {
      fireEvent.load(img);
    });

    // Image should now be visible
    expect(img.className).toContain("block");
    // Fallback should still be visible (it's up to CSS to handle overlap)
    expect(screen.getByText("MN")).toBeInTheDocument();
  });
});
