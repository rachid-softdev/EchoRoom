import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CallAudioVisualizer } from "../CallAudioVisualizer";

afterEach(() => {
  cleanup();
});

describe("CallAudioVisualizer", () => {
  it("renders 20 audio bars", () => {
    const { container } = render(<CallAudioVisualizer />);

    // The bars are div children of the container
    const bars = container.firstElementChild?.children;
    expect(bars).toHaveLength(20);
  });

  it("renders each bar with animation style properties", () => {
    const { container } = render(<CallAudioVisualizer />);

    const bars = container.firstElementChild?.children;
    expect(bars).toHaveLength(20);

    // Each bar should have an inline style with animation and height
    Array.from(bars!).forEach((bar) => {
      const style = bar.getAttribute("style") ?? "";
      expect(style).toContain("animation:");
      expect(style).toContain("height:");
      expect(style).toContain("animation-delay:");
    });
  });

  it("sets aria-hidden='true' on the container", () => {
    const { container } = render(<CallAudioVisualizer />);

    const barsContainer = container.firstElementChild!;
    expect(barsContainer).toHaveAttribute("aria-hidden", "true");
  });

  it("assigns incremental animation delays per bar", () => {
    const { container } = render(<CallAudioVisualizer />);

    const bars = container.firstElementChild?.children;
    expect(bars).toHaveLength(20);

    // The delay should increase by ~0.05 each bar (i * 0.05)
    const delays = Array.from(bars!).map((bar) =>
      parseFloat(bar.getAttribute("style")?.match(/animation-delay:\s*([\d.]+)s/)?.[1] ?? "0"),
    );

    // Each delay should be >= previous delay (within floating point tolerance)
    for (let i = 1; i < delays.length; i++) {
      expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]! - 0.001);
    }
  });

  it("renders bars with varying heights", () => {
    const { container } = render(<CallAudioVisualizer />);

    const bars = container.firstElementChild?.children;
    expect(bars).toHaveLength(20);

    const heights = Array.from(bars!).map((bar) =>
      parseFloat(bar.getAttribute("style")?.match(/height:\s*([\d.]+)%/)?.[1] ?? "0"),
    );

    // All heights should be between 30 and 100
    heights.forEach((h) => {
      expect(h).toBeGreaterThanOrEqual(30);
      expect(h).toBeLessThanOrEqual(100);
    });

    // Not all heights should be identical (random variation)
    const uniqueHeights = new Set(heights.map((h) => Math.round(h)));
    expect(uniqueHeights.size).toBeGreaterThan(1);
  });
});
