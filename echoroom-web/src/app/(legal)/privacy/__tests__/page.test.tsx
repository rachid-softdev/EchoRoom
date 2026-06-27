import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

describe("PrivacyPage (Politique de confidentialité)", () => {
  let PrivacyPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    PrivacyPage = mod.default;
  });

  it("renders the main heading", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", {
        name: /politique de confidentialité/i,
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("renders the last updated date", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/Dernière mise à jour : janvier 2025/i)).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    render(<PrivacyPage />);

    const sections = [
      /1\. Données collectées/,
      /2\. Base légale du traitement/,
      /3\. Destinataires des données/,
      /4\. Durée de conservation/,
      /5\. Vos droits \(RGPD\)/,
      /6\. Cookies/,
      /7\. Contact/,
    ];

    for (const section of sections) {
      expect(screen.getByRole("heading", { name: section, level: 2 })).toBeInTheDocument();
    }
  });

  it("renders the collected data list items", () => {
    render(<PrivacyPage />);

    const dataItems = [
      /Adresse email/,
      /Nom d'utilisateur/,
      /Mot de passe \(crypté\)/,
      /Numéro de téléphone/,
      /Enregistrements audio/,
      /Contenu des scénarios/,
      /Données de navigation/,
    ];

    for (const item of dataItems) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders the RGPD rights list", () => {
    render(<PrivacyPage />);

    const rights = [
      /Droit d'accès/,
      /Droit de rectification/,
      /Droit à l'effacement/,
      /Droit à la limitation/,
      /Droit à la portabilité/,
      /Droit d'opposition/,
    ];

    for (const right of rights) {
      expect(screen.getByText(right)).toBeInTheDocument();
    }
  });

  it("renders the DPO contact link", () => {
    render(<PrivacyPage />);

    const dpoLink = screen.getByRole("link", { name: "dpo@echoroom.app" });
    expect(dpoLink).toHaveAttribute("href", "mailto:dpo@echoroom.app");
  });

  it("renders the cookies section", () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText(/Nous utilisons uniquement des cookies techniques/i),
    ).toBeInTheDocument();
  });
});
