import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("ScenarioLayout", () => {
  let ScenarioLayout: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../layout");
    ScenarioLayout = mod.default;
  });

  it("renders children correctly", () => {
    render(
      <ScenarioLayout>
        <div data-testid="child">Enfant du layout</div>
      </ScenarioLayout>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Enfant du layout")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <ScenarioLayout>
        <span data-testid="child-1">Premier</span>
        <span data-testid="child-2">Deuxième</span>
      </ScenarioLayout>,
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("does not add any extra wrapper elements", () => {
    const { container } = render(
      <ScenarioLayout>
        <div data-testid="only-child">Seul</div>
      </ScenarioLayout>,
    );

    // The layout is just a fragment, so the child should be a direct child of container
    const child = screen.getByTestId("only-child");
    expect(child).toBeInTheDocument();
    expect(container.firstChild).toBe(child);
  });
});
