import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl } from "../segmented-control";

afterEach(() => {
  cleanup();
});

describe("SegmentedControl", () => {
  const options = [
    { value: "pending", label: "En attente" },
    { value: "approved", label: "Approuvé" },
    { value: "rejected", label: "Rejeté" },
  ];

  it("renders all options as buttons", () => {
    render(<SegmentedControl options={options} value="pending" onChange={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "En attente" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Approuvé" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Rejeté" })).toBeInTheDocument();
  });

  it("marks the selected option as checked", () => {
    render(<SegmentedControl options={options} value="approved" onChange={vi.fn()} />);

    const approved = screen.getByRole("radio", { name: "Approuvé" });
    expect(approved).toHaveAttribute("aria-checked", "true");

    const pending = screen.getByRole("radio", { name: "En attente" });
    expect(pending).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with the option value when clicked", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<SegmentedControl options={options} value="pending" onChange={handleChange} />);

    await user.click(screen.getByRole("radio", { name: "Approuvé" }));
    expect(handleChange).toHaveBeenCalledWith("approved");
  });

  it("highlights the selected option with bg-card class", () => {
    render(<SegmentedControl options={options} value="rejected" onChange={vi.fn()} />);

    const rejected = screen.getByRole("radio", { name: "Rejeté" });
    expect(rejected.className).toContain("bg-card");
    expect(rejected.className).toContain("shadow-sm");
  });

  it("has radiogroup role on container", () => {
    render(<SegmentedControl options={options} value="pending" onChange={vi.fn()} />);

    const group = screen.getByRole("radiogroup");
    expect(group).toBeInTheDocument();
  });

  it("accepts custom className", () => {
    const { container } = render(
      <SegmentedControl
        options={options}
        value="pending"
        onChange={vi.fn()}
        className="my-custom-class"
      />,
    );

    const group = container.firstChild as HTMLElement;
    expect(group.className).toContain("my-custom-class");
  });

  it("renders with single option", () => {
    render(
      <SegmentedControl
        options={[{ value: "single", label: "Solo" }]}
        value="single"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "Solo" })).toBeInTheDocument();
  });
});
