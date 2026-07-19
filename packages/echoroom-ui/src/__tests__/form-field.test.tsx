import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FormField } from "../organisms/FormField";

afterEach(() => cleanup());

describe("FormField", () => {
  it("renders the label and associates it with the control", () => {
    render(
      <FormField label="Name" htmlFor="name">
        <input id="name" />
      </FormField>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("shows the error and hides the hint when both are present", () => {
    render(
      <FormField label="Email" error="Required" hint="We never share">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("We never share")).not.toBeInTheDocument();
  });

  it("shows a required marker", () => {
    render(
      <FormField label="Phone" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });
});
