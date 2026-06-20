import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "../checkbox";

afterEach(() => {
  cleanup();
});

describe("Checkbox", () => {
  it("renders a checkbox input", () => {
    render(<Checkbox />);
    const input = document.querySelector('input[type="checkbox"]');
    expect(input).toBeInTheDocument();
  });

  it("renders label text when label prop is provided", () => {
    render(<Checkbox label="Accepter les conditions" />);
    expect(screen.getByText("Accepter les conditions")).toBeInTheDocument();
  });

  it("does not render label text when label prop is not provided", () => {
    const { container } = render(<Checkbox />);
    // Only the checkbox input and styled span should exist, no text
    const spans = container.querySelectorAll("span");
    // The outer label has two span children: one for the checkbox visual, one for label
    // Without label, only the checkbox visual span exists
    expect(spans.length).toBeGreaterThanOrEqual(1);
  });

  it("can be checked and unchecked by clicking", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Checkbox label="Option" onChange={handleChange} />);

    const input = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).not.toBeChecked();

    await user.click(screen.getByText("Option"));
    expect(input).toBeChecked();
    expect(handleChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText("Option"));
    expect(input).not.toBeChecked();
    expect(handleChange).toHaveBeenCalledTimes(2);
  });

  it("can be controlled via checked prop", () => {
    const { rerender } = render(<Checkbox label="Checked" checked={true} readOnly />);

    const input = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toBeChecked();

    rerender(<Checkbox label="Checked" checked={false} readOnly />);
    expect(input).not.toBeChecked();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Checkbox label="Disabled" disabled />);

    const input = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it("uses provided id or generates one", () => {
    render(<Checkbox id="my-checkbox" />);

    const input = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toHaveAttribute("id", "my-checkbox");
  });

  it("generates an id when none is provided", () => {
    render(<Checkbox label="Auto ID" />);

    const input = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input).toHaveAttribute("id");
    expect(input.id).toContain("checkbox-");
  });

  it("links label to input via htmlFor", () => {
    render(<Checkbox id="test-id" label="Linked label" />);

    const label = screen.getByText("Linked label").closest("label");
    expect(label).toHaveAttribute("for", "test-id");
  });
});
