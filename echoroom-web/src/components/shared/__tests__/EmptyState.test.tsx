import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EmptyState } from "../EmptyState";
import { Search } from "lucide-react";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("EmptyState", () => {
  it("renders icon, title and description", () => {
    render(
      <EmptyState
        icon={Search}
        title="No results"
        description="Try a different search"
      />,
    );

    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      "No results",
    );
    expect(screen.getByText("Try a different search")).toBeInTheDocument();
    // Icon should render as an SVG
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders action button when provided", () => {
    render(
      <EmptyState
        icon={Search}
        title="No results"
        description="Try again"
        action={<button>Create</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("does not render action container when no action prop", () => {
    const { container } = render(
      <EmptyState icon={Search} title="No results" description="Try again" />,
    );

    // Only the icon, title and description should be present — no extra button space
    expect(container.querySelector("button")).not.toBeInTheDocument();
  });

  it("renders with correct accessible heading level", () => {
    render(
      <EmptyState icon={Search} title="Heading" description="Desc" />,
    );

    const heading = screen.getAllByRole("heading", { level: 3 })[0];
    expect(heading).toHaveTextContent("Heading");
  });
});
