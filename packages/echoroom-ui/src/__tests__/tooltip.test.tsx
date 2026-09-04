import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Tooltip } from "../atoms/tooltip";

afterEach(() => {
  cleanup();
});

describe("Tooltip", () => {
  it("renders children but hides tooltip initially", () => {
    render(
      <Tooltip content="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Help text">
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    await user.hover(screen.getByText("Hover me"));

    expect(await screen.findByRole("tooltip")).toHaveTextContent("Help text");
  });

  it("hides tooltip on mouse leave", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Help text">
        <button type="button">Hover me</button>
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
        <button type="button">Hover me</button>
      </Tooltip>,
    );

    expect(screen.getByText("Hover me")).toBeInTheDocument();
  });
});
