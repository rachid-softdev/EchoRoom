import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from "../organisms/EmptyState";

afterEach(() => cleanup());

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No results" />);
    expect(screen.getByText("No results")).toBeInTheDocument();
  });

  it("renders description and action when provided", () => {
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        action={<button type="button">Create</button>}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("renders an icon node", () => {
    render(
      <EmptyState title="X" icon={<span data-testid="ico">*</span>} />,
    );
    expect(screen.getByTestId("ico")).toBeInTheDocument();
  });

  it("applies an extra className", () => {
    const { container } = render(<EmptyState title="X" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});
