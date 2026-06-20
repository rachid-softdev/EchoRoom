import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

describe("TermsPage (Conditions d'utilisation)", () => {
  let TermsPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    TermsPage = mod.default;
  });

  it("renders the main heading", () => {
    render(<TermsPage />);
    expect(
      screen.getByRole("heading", {
        name: /conditions d'utilisation/i,
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("renders the last updated date", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/Dernière mise à jour : janvier 2025/i),
    ).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    render(<TermsPage />);

    const sections = [
      /1\. Acceptation des conditions/,
      /2\. Description du service/,
      /3\. Crédits et paiements/,
      /4\. Contenu utilisateur/,
      /5\. Modération/,
      /6\. Propriété intellectuelle/,
      /7\. Limitation de responsabilité/,
      /8\. Contact/,
    ];

    for (const section of sections) {
      expect(
        screen.getByRole("heading", { name: section, level: 2 }),
      ).toBeInTheDocument();
    }
  });

  it("renders the service description", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/EchoRoom AI est une plateforme de divertissement social/i),
    ).toBeInTheDocument();
  });

  it("renders the credits section", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/Les appels IA consomment des crédits/i),
    ).toBeInTheDocument();
  });

  it("renders the moderation section", () => {
    render(<TermsPage />);
    expect(
      screen.getByText(/EchoRoom AI se réserve le droit de modérer/i),
    ).toBeInTheDocument();
  });

  it("renders the legal contact link", () => {
    render(<TermsPage />);

    const legalLink = screen.getByRole("link", { name: "legal@echoroom.app" });
    expect(legalLink).toHaveAttribute("href", "mailto:legal@echoroom.app");
  });
});
