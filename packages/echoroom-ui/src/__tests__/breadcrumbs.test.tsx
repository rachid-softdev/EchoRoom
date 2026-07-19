import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Breadcrumbs } from "../organisms/Breadcrumbs";

afterEach(() => cleanup());

const items = [
  { label: "Accueil", href: "/" },
  { label: "Library", href: "/library" },
  { label: "Item" },
];

describe("Breadcrumbs", () => {
  it("renders every label", () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByText("Accueil")).toBeInTheDocument();
    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("Item")).toBeInTheDocument();
  });

  it("marks the last item as the current page", () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByText("Item")).toHaveAttribute("aria-current", "page");
  });

  it("renders links for non-last items", () => {
    render(<Breadcrumbs items={items} />);
    expect(screen.getByText("Accueil").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Item").closest("a")).toBeNull();
  });
});
