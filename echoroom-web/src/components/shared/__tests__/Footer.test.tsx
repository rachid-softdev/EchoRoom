import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "../Footer";

// ---------------------------------------------------------------------------
// Mock next/link so we can assert on href attributes
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("Footer", () => {
  it("renders the current year", () => {
    render(<Footer />);

    const currentYear = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(currentYear))).toBeInTheDocument();
  });

  it("renders 'EchoRoom AI' branding", () => {
    render(<Footer />);

    expect(screen.getByText(/EchoRoom AI/)).toBeInTheDocument();
  });

  it("renders help link with correct href", () => {
    render(<Footer />);

    const helpLink = screen.getByRole("link", { name: "Aide" });
    expect(helpLink).toBeInTheDocument();
    expect(helpLink).toHaveAttribute("href", "/help");
  });

  it("renders terms link with correct href", () => {
    render(<Footer />);

    const termsLink = screen.getByRole("link", { name: "Conditions" });
    expect(termsLink).toBeInTheDocument();
    expect(termsLink).toHaveAttribute("href", "/terms");
  });

  it("renders privacy link with correct href", () => {
    render(<Footer />);

    const privacyLink = screen.getByRole("link", { name: "Confidentialité" });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute("href", "/privacy");
  });

  it("renders links in French labels", () => {
    render(<Footer />);

    expect(screen.getByText("Aide")).toBeInTheDocument();
    expect(screen.getByText("Conditions")).toBeInTheDocument();
    expect(screen.getByText("Confidentialité")).toBeInTheDocument();
  });

  it("renders as a <footer> element", () => {
    const { container } = render(<Footer />);

    const footer = container.querySelector("footer");
    expect(footer).toBeInTheDocument();
  });

  it("renders all three links in a nav", () => {
    render(<Footer />);

    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();

    const links = nav.querySelectorAll("a");
    expect(links).toHaveLength(3);
  });
});
