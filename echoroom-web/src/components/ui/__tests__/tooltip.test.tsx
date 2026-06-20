import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "../tooltip";

afterEach(() => {
  cleanup();
});

describe("Tooltip", () => {
  it("renders children but hides tooltip initially", () => {
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );

    await user.hover(screen.getByText("Hover me"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Help text");
  });

  it("hides tooltip on mouse leave", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Help text">
        <button>Hover me</button>
      </Tooltip>,
    );

    await user.hover(screen.getByText("Hover me"));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();

    await user.unhover(screen.getByText("Hover me"));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders with empty content without crashing", () => {
    render(
      <Tooltip content="">
        <button>Hover me</button>
      </Tooltip>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });
});
