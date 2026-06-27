import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../input";

afterEach(() => {
  cleanup();
});

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Input placeholder="Entrez votre email" />);
    expect(screen.getByPlaceholderText("Entrez votre email")).toBeInTheDocument();
  });

  it("accepts value and onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Input value="test" onChange={handleChange} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("test");

    await user.type(input, "a");
    expect(handleChange).toHaveBeenCalled();
  });

  it("renders with different type attributes", () => {
    render(<Input type="email" data-testid="email-input" />);
    const input = screen.getByTestId("email-input");
    expect(input).toHaveAttribute("type", "email");
  });

  it("accepts custom className", () => {
    render(<Input className="custom-class" data-testid="input" />);
    const input = screen.getByTestId("input");
    expect(input.className).toContain("custom-class");
  });

  it("can be disabled", () => {
    render(<Input disabled data-testid="input" />);
    expect(screen.getByTestId("input")).toBeDisabled();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLInputElement | null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
