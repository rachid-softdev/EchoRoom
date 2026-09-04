import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PageHeader } from "../organisms/PageHeader";

afterEach(() => cleanup());

describe("PageHeader", () => {
  it("renders the title as a heading and the description", () => {
    render(
      <PageHeader title="Settings" description="Manage your account" />,
    );
    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("Manage your account")).toBeInTheDocument();
  });

  it("renders the actions slot", () => {
    render(
      <PageHeader title="X" actions={<button type="button">Save</button>} />,
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("applies an extra className", () => {
    const { container } = render(<PageHeader title="X" className="my-ph" />);
    expect(container.firstChild).toHaveClass("my-ph");
  });
});
