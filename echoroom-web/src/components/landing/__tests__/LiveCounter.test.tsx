import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveCounter } from "../LiveCounter";

afterEach(() => {
  cleanup();
});

describe("LiveCounter", () => {
  it("renders a number formatted in French locale", () => {
    render(<LiveCounter />);

    const el = screen.getByText(/\d/);
    expect(el).toBeInTheDocument();

    // French locale uses non-breaking space or regular space as thousands separator
    const text = el.textContent!;
    expect(text).toMatch(/^[\d\s]+$/);

    // The number should be between 1800 and 4200 (with possible formatting)
    const numericValue = parseInt(text.replace(/\s/g, ""), 10);
    expect(numericValue).toBeGreaterThanOrEqual(1800);
    expect(numericValue).toBeLessThanOrEqual(4200);
  });

  it("accepts and applies a className prop", () => {
    const { container } = render(<LiveCounter className="text-lg font-bold" />);

    const span = container.firstElementChild!;
    expect(span).toHaveClass("text-lg");
    expect(span).toHaveClass("font-bold");
  });

  it("generates a different count on each render (random)", () => {
    // Render multiple instances and verify they produce different numbers
    const values = new Set<number>();

    for (let i = 0; i < 5; i++) {
      const { unmount } = render(<LiveCounter />);
      const text = screen.getByText(/\d/).textContent!;
      const numericValue = parseInt(text.replace(/\s/g, ""), 10);
      values.add(numericValue);
      unmount();
    }

    // With 5 renders and a range of 2400 values, we expect at least 2 different ones
    // (extremely unlikely to get the same number 5 times)
    expect(values.size).toBeGreaterThan(1);
  });

  it("renders without className prop", () => {
    const { container } = render(<LiveCounter />);

    const span = container.firstElementChild!;
    expect(span.tagName).toBe("SPAN");
    expect(span.textContent).toMatch(/\d/);
  });
});
