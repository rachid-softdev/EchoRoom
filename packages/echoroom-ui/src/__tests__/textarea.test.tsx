import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Textarea } from "../atoms/textarea";

afterEach(() => {
  cleanup();
});

describe("Textarea", () => {
  it("renders a textarea element", () => {
    render(<Textarea />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
  });

  it("renders with placeholder", () => {
    render(<Textarea placeholder="Décrivez votre expérience" />);
    expect(screen.getByPlaceholderText("Décrivez votre expérience")).toBeInTheDocument();
  });

  it("accepts value and onChange", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Textarea value="Hello" onChange={handleChange} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("Hello");

    await user.type(textarea, " world");
    expect(handleChange).toHaveBeenCalled();
  });

  it("accepts custom className", () => {
    render(<Textarea className="custom-class" data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");
    expect(textarea.className).toContain("custom-class");
  });

  it("can be disabled", () => {
    render(<Textarea disabled data-testid="textarea" />);
    expect(screen.getByTestId("textarea")).toBeDisabled();
  });

  it("forwards ref correctly", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<Textarea ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
  });

  it("has min-h-[80px] class", () => {
    render(<Textarea data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");
    expect(textarea.className).toContain("min-h-[80px]");
  });

  it("renders with rows attribute", () => {
    render(<Textarea rows={5} data-testid="textarea" />);
    const textarea = screen.getByTestId("textarea");
    expect(textarea).toHaveAttribute("rows", "5");
  });
});
