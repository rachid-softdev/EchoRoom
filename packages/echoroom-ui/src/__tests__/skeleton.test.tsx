import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Skeleton } from "../atoms/skeleton";

afterEach(() => {
  cleanup();
});

describe("Skeleton", () => {
  it("renders a div with animate-pulse class", () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.tagName).toBe("DIV");
    expect(div.className).toContain("animate-pulse");
    expect(div.className).toContain("rounded-md");
    expect(div.className).toContain("bg-muted");
  });

  it("accepts custom className", () => {
    const { container } = render(<Skeleton className="h-10 w-20" />);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain("h-10");
    expect(div.className).toContain("w-20");
    expect(div.className).toContain("animate-pulse");
  });

  it("accepts additional HTML attributes", () => {
    render(<Skeleton data-testid="my-skeleton" />);
    expect(screen.getByTestId("my-skeleton")).toBeInTheDocument();
  });

  it("renders without crashing with no props", () => {
    const { container } = render(<Skeleton />);
    expect(container.firstChild).toBeInTheDocument();
  });
});
