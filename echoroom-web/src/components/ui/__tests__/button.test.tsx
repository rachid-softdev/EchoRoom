import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Button } from "../button";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it("renders as a <button> element by default", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn.tagName).toBe("BUTTON");
  });

  it("renders as a <button> with default variant classes", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button", { name: /default/i });
    expect(btn.className).toContain("bg-primary");
    expect(btn.className).toContain("text-primary-foreground");
  });

  it("renders as a <button> with destructive variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);
    const btn = screen.getByRole("button", { name: /delete/i });
    expect(btn.className).toContain("bg-destructive");
  });

  // ─── asChild tests ────────────────────────────────────────

  it("renders asChild element as the child's tag, NOT a <span> or <button>", () => {
    render(
      <Button asChild>
        <a href="/test">Link</a>
      </Button>,
    );
    // There should be NO button in the document
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    // There SHOULD be a link
    const link = screen.getByRole("link", { name: /link/i });
    expect(link).toBeInTheDocument();
    expect(link.tagName).toBe("A");
  });

  it("preserves the href attribute when using asChild with an <a> element", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Dashboard</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /dashboard/i });
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("merges class names correctly with asChild (variant + custom)", () => {
    render(
      <Button asChild variant="destructive" className="my-custom-class">
        <a href="/delete">Delete</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /delete/i });
    // Should contain variant classes
    expect(link.className).toContain("bg-destructive");
    // Should contain custom class
    expect(link.className).toContain("my-custom-class");
  });

  it("renders asChild with default variant if no variant specified", () => {
    render(
      <Button asChild>
        <a href="/">Home</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /home/i });
    expect(link.className).toContain("bg-primary");
    expect(link.className).toContain("text-primary-foreground");
  });

  it("renders asChild with size classes", () => {
    render(
      <Button asChild size="lg">
        <a href="/">Large</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: /large/i });
    expect(link.className).toContain("h-11");
    expect(link.className).toContain("rounded-xl");
    expect(link.className).toContain("px-8");
  });

  it("renders children text content correctly", () => {
    render(<Button>Save Changes</Button>);
    const btn = screen.getByRole("button", { name: /save changes/i });
    expect(btn).toHaveTextContent("Save Changes");
  });
});
