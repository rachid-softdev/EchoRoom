import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/link
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

describe("HelpPage (FAQ)", () => {
  let HelpPage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    HelpPage = mod.default;
  });

  it("renders the main heading", () => {
    render(<HelpPage />);
    expect(screen.getByRole("heading", { name: /aide & faq/i, level: 1 })).toBeInTheDocument();
  });

  it("renders the description paragraph", () => {
    render(<HelpPage />);
    expect(screen.getByText(/tout ce qu'il faut savoir pour plonger/i)).toBeInTheDocument();
  });

  it("renders all FAQ questions", () => {
    render(<HelpPage />);

    const questions = [
      "C'est quoi EchoRoom ?",
      "Comment ça marche ?",
      "C'est quoi les crédits ?",
      "Je peux écouter les appels des autres ?",
      "Comment je partage un moment ?",
      "Les appels sont-ils modérés ?",
      "C'est gratuit ?",
      "Je peux créer mes propres scénarios ?",
      "Comment signaler un abus ?",
    ];

    for (const q of questions) {
      expect(screen.getByText(q)).toBeInTheDocument();
    }
  });

  it("renders the support section with Discord and explore links", () => {
    render(<HelpPage />);

    expect(screen.getByText(/besoin d'aide supplémentaire/i)).toBeInTheDocument();

    const discordLink = screen.getByRole("link", { name: /communauté discord/i });
    expect(discordLink).toHaveAttribute("href", "/community");

    const exploreLink = screen.getByRole("link", { name: /scénarios tendance/i });
    expect(exploreLink).toHaveAttribute("href", "/explore");
  });

  it("renders all FAQ details elements with summary tags", () => {
    render(<HelpPage />);

    const details = document.querySelectorAll("details");
    expect(details.length).toBe(9);

    const summaries = document.querySelectorAll("summary");
    expect(summaries.length).toBe(9);
  });
});
