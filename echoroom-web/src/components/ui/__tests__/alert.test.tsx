import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "../alert";

afterEach(() => {
  cleanup();
});

describe("Alert", () => {
  it("renders with default variant", () => {
    render(<Alert>Content</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Content");
  });

  it("renders with warning variant", () => {
    render(<Alert variant="warning">Warning</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("bg-yellow-50");
  });

  it("renders with destructive variant", () => {
    render(<Alert variant="destructive">Error</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-destructive");
  });

  it("accepts custom className", () => {
    render(<Alert className="my-custom-class">Custom</Alert>);
    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("my-custom-class");
  });

  it("renders AlertTitle", () => {
    render(
      <Alert>
        <AlertTitle>Title Here</AlertTitle>
      </Alert>,
    );
    expect(screen.getByText("Title Here")).toBeInTheDocument();
    expect(screen.getByText("Title Here").tagName).toBe("H5");
  });

  it("renders AlertDescription", () => {
    render(
      <Alert>
        <AlertDescription>Description text</AlertDescription>
      </Alert>,
    );
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("renders Alert, AlertTitle and AlertDescription together", () => {
    render(
      <Alert>
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>Description</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
  });
});
