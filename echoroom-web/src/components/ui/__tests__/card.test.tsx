import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../card";

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Tests — Card
// ---------------------------------------------------------------------------

describe("Card", () => {
  it("renders as a div with card classes", () => {
    const { container } = render(<Card />);

    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("rounded-xl");
    expect(el.className).toContain("border");
    expect(el.className).toContain("bg-card");
    expect(el.className).toContain("shadow-sm");
  });

  it("renders children", () => {
    render(
      <Card>
        <span data-testid="child">Content</span>
      </Card>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<Card className="my-custom-class" />);

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("my-custom-class");
  });
});

// ---------------------------------------------------------------------------
// Tests — CardHeader
// ---------------------------------------------------------------------------

describe("CardHeader", () => {
  it("renders as a div with header classes", () => {
    const { container } = render(<CardHeader />);

    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("flex-col");
    expect(el.className).toContain("p-6");
  });

  it("renders children", () => {
    render(<CardHeader>Header Content</CardHeader>);

    expect(screen.getByText("Header Content")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<CardHeader className="custom-header" />);

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom-header");
  });
});

// ---------------------------------------------------------------------------
// Tests — CardTitle
// ---------------------------------------------------------------------------

describe("CardTitle", () => {
  it("renders as an h3 element", () => {
    render(<CardTitle>Title</CardTitle>);

    const el = screen.getByText("Title");
    expect(el.tagName).toBe("H3");
  });

  it("has heading role", () => {
    render(<CardTitle>Accessible Title</CardTitle>);

    expect(screen.getByRole("heading", { name: /accessible title/i })).toBeInTheDocument();
  });

  it("renders children", () => {
    render(<CardTitle>My Card Title</CardTitle>);

    expect(screen.getByText("My Card Title")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    render(<CardTitle className="custom-title">Styled</CardTitle>);

    const el = screen.getByText("Styled");
    expect(el.className).toContain("custom-title");
    expect(el.className).toContain("text-2xl");
    expect(el.className).toContain("font-semibold");
  });
});

// ---------------------------------------------------------------------------
// Tests — CardDescription
// ---------------------------------------------------------------------------

describe("CardDescription", () => {
  it("renders as a paragraph element", () => {
    render(<CardDescription>Description</CardDescription>);

    const el = screen.getByText("Description");
    expect(el.tagName).toBe("P");
  });

  it("renders children", () => {
    render(<CardDescription>Some description text</CardDescription>);

    expect(screen.getByText("Some description text")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    render(<CardDescription className="custom-desc">Styled</CardDescription>);

    const el = screen.getByText("Styled");
    expect(el.className).toContain("custom-desc");
    expect(el.className).toContain("text-sm");
    expect(el.className).toContain("text-muted-foreground");
  });
});

// ---------------------------------------------------------------------------
// Tests — CardContent
// ---------------------------------------------------------------------------

describe("CardContent", () => {
  it("renders as a div with content classes", () => {
    const { container } = render(<CardContent />);

    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("p-6");
    expect(el.className).toContain("pt-0");
  });

  it("renders children", () => {
    render(<CardContent>Content Body</CardContent>);

    expect(screen.getByText("Content Body")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<CardContent className="custom-content" />);

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom-content");
  });
});

// ---------------------------------------------------------------------------
// Tests — CardFooter
// ---------------------------------------------------------------------------

describe("CardFooter", () => {
  it("renders as a div with footer classes", () => {
    const { container } = render(<CardFooter />);

    const el = container.firstChild as HTMLElement;
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("flex");
    expect(el.className).toContain("items-center");
    expect(el.className).toContain("p-6");
    expect(el.className).toContain("pt-0");
  });

  it("renders children", () => {
    render(<CardFooter>Footer Content</CardFooter>);

    expect(screen.getByText("Footer Content")).toBeInTheDocument();
  });

  it("accepts and applies additional className", () => {
    const { container } = render(<CardFooter className="custom-footer" />);

    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("custom-footer");
  });
});

// ---------------------------------------------------------------------------
// Tests — Composition
// ---------------------------------------------------------------------------

describe("Card composition", () => {
  it("renders a complete card with all subcomponents", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Complete Card</CardTitle>
          <CardDescription>This is a full card example</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main card body</p>
        </CardContent>
        <CardFooter>
          <button type="button">Action</button>
        </CardFooter>
      </Card>,
    );

    expect(screen.getByText("Complete Card")).toBeInTheDocument();
    expect(screen.getByText("This is a full card example")).toBeInTheDocument();
    expect(screen.getByText("Main card body")).toBeInTheDocument();
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});
