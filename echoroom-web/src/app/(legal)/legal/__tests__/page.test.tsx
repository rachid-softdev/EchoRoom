import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

describe("LegalPage (Mentions légales)", () => {
  let LegalPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    LegalPage = mod.default;
  });

  it("renders the main heading", () => {
    render(<LegalPage />);
    expect(
      screen.getByRole("heading", { name: /mentions légales/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders the law reference paragraph", () => {
    render(<LegalPage />);
    expect(screen.getByText(/loi n° 2004-575 du 21 juin 2004/i)).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    render(<LegalPage />);

    const sections = [
      "Éditeur",
      "Directeur de la publication",
      "Hébergement",
      "Contact",
      "Crédits",
    ];

    for (const section of sections) {
      expect(screen.getByRole("heading", { name: section, level: 2 })).toBeInTheDocument();
    }
  });

  it("renders company details in the Éditeur section", () => {
    render(<LegalPage />);
    expect(screen.getByText("EchoRoom AI")).toBeInTheDocument();
    expect(screen.getByText(/128 Rue de Rivoli, 75001 Paris/i)).toBeInTheDocument();
  });

  it("renders contact email links", () => {
    render(<LegalPage />);

    expect(screen.getByRole("link", { name: "contact@echoroom.app" })).toHaveAttribute(
      "href",
      "mailto:contact@echoroom.app",
    );

    expect(screen.getByRole("link", { name: "support@echoroom.app" })).toHaveAttribute(
      "href",
      "mailto:support@echoroom.app",
    );

    expect(screen.getByRole("link", { name: "legal@echoroom.app" })).toHaveAttribute(
      "href",
      "mailto:legal@echoroom.app",
    );

    expect(screen.getByRole("link", { name: "dpo@echoroom.app" })).toHaveAttribute(
      "href",
      "mailto:dpo@echoroom.app",
    );
  });

  it("renders the hébergement section with Vercel info", () => {
    render(<LegalPage />);
    expect(screen.getByText("Vercel Inc.")).toBeInTheDocument();
    const vercelLink = screen.getByRole("link", { name: /https:\/\/vercel.com/i });
    expect(vercelLink).toHaveAttribute("href", "https://vercel.com");
  });

  it("renders the crédits section", () => {
    render(<LegalPage />);
    expect(screen.getByText(/Design et développement/i)).toBeInTheDocument();
    const lucideLink = screen.getByRole("link", { name: /Lucide/i });
    expect(lucideLink).toHaveAttribute("href", "https://lucide.dev");
  });
});
