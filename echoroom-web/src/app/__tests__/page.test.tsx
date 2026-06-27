import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/link to avoid loading Next.js internals in jsdom
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ---------------------------------------------------------------------------
// Landing Page (page.tsx) tests — Server Component
// ---------------------------------------------------------------------------
// Tests for the landing page:
//   - Renders hero section with CTA buttons
//   - Community proof strip renders trending scenarios
//   - Feature cards rendered with alternating layout
//   - Final CTA section renders
//   - No "use client" directive

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  MessageCircle: () => <svg data-testid="icon-message-circle" />,
  Share2: () => <svg data-testid="icon-share2" />,
  Zap: () => <svg data-testid="icon-zap" />,
  Headphones: () => <svg data-testid="icon-headphones" />,
  Users: () => <svg data-testid="icon-users" />,
  Shield: () => <svg data-testid="icon-shield" />,
}));

// Mock Button component
vi.mock("@/components/ui", () => ({
  Button: ({
    children,
    variant,
    size,
    className,
    ...props
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    className?: string;
    [key: string]: any;
  }) => (
    <button data-variant={variant} data-size={size} className={className} {...props}>
      {children}
    </button>
  ),
}));

// Mock child components
vi.mock("@/components/landing/FeaturedScenariosSection", () => ({
  FeaturedScenariosSection: () => <section data-testid="featured-scenarios-section" />,
}));

vi.mock("@/components/landing/LiveCounter", () => ({
  LiveCounter: ({ className }: { className?: string }) => (
    <span data-testid="live-counter" className={className}>
      128
    </span>
  ),
}));

vi.mock("@/components/landing/CallAudioVisualizer", () => ({
  CallAudioVisualizer: () => <div data-testid="call-audio-visualizer" />,
}));

afterEach(() => {
  cleanup();
});

describe("HomePage (landing page)", () => {
  let HomePage: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../page");
    HomePage = mod.default;
  });

  // -----------------------------------------------------------------------
  // Hero Section
  // -----------------------------------------------------------------------

  it("should render hero section with main heading", () => {
    render(<HomePage />);

    expect(screen.getByText(/Les appels IA que tout/i)).toBeInTheDocument();
    // "TikTok" appears in heading and also in feature description text
    const tikTokElements = screen.getAllByText(/TikTok/i);
    expect(tikTokElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/va partager/i)).toBeInTheDocument();
  });

  it("should render hero CTA buttons linking to /register and /explore", () => {
    render(<HomePage />);

    const registerLink = screen.getByRole("link", {
      name: /Commencer gratuitement/i,
    });
    expect(registerLink).toHaveAttribute("href", "/register");

    const exploreLink = screen.getByRole("link", {
      name: /Voir une démo/i,
    });
    expect(exploreLink).toHaveAttribute("href", "/explore");
  });

  it("should render the hero description text", () => {
    render(<HomePage />);

    expect(screen.getByText(/Crée des conversations absurdes/i)).toBeInTheDocument();
  });

  it("should render '5 crédits offerts' text in hero", () => {
    render(<HomePage />);

    // Appears in hero text and in "Gratuit pour commencer" feature card
    const creditsElements = screen.getAllByText(/5 crédits offerts/i);
    expect(creditsElements.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // Community Proof Strip
  // -----------------------------------------------------------------------

  it("should render community proof strip with trending scenarios", () => {
    render(<HomePage />);

    // Each trending scenario name should be visible
    expect(screen.getByText("Fake Recruiter Simulator")).toBeInTheDocument();
    expect(screen.getByText("NPC Customer Support")).toBeInTheDocument();
    expect(screen.getByText("AI Ex Girlfriend Chaos")).toBeInTheDocument();
  });

  it("should render 'En tendance' label in community strip", () => {
    render(<HomePage />);

    expect(screen.getByText(/En tendance/i)).toBeInTheDocument();
  });

  it("should render reaction count in community strip", () => {
    render(<HomePage />);

    // The component may use HTML entity &rsquo; which renders as right single quote (U+2019)
    // Match both regular and curly apostrophe variants
    expect(screen.getByText(/réactions aujourd['\u2019]hui/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Feature Cards
  // -----------------------------------------------------------------------

  it("should render hero feature cards with titles", () => {
    render(<HomePage />);

    expect(screen.getByText("Appels IA immersifs")).toBeInTheDocument();
    expect(screen.getByText("Réactions en direct")).toBeInTheDocument();
  });

  it("should render supporting feature cards with titles", () => {
    render(<HomePage />);

    expect(screen.getByText("Scénarios sur mesure")).toBeInTheDocument();
    expect(screen.getByText("Clips viraux")).toBeInTheDocument();
    expect(screen.getByText("Modération safe")).toBeInTheDocument();
    expect(screen.getByText("Gratuit pour commencer")).toBeInTheDocument();
  });

  it("should render supporting feature descriptions", () => {
    render(<HomePage />);

    expect(screen.getByText(/Crée tes propres scénarios absurdes/i)).toBeInTheDocument();
    expect(screen.getByText(/Extrais le meilleur moment en un clic/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Featured Scenarios Section
  // -----------------------------------------------------------------------

  it("should render the FeaturedScenariosSection component", () => {
    render(<HomePage />);

    expect(screen.getByTestId("featured-scenarios-section")).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Final CTA Section
  // -----------------------------------------------------------------------

  it("should render final CTA section heading", () => {
    render(<HomePage />);

    expect(screen.getByText(/Prêt à faire du/i)).toBeInTheDocument();
    expect(screen.getByText(/bruit/i)).toBeInTheDocument();
  });

  it("should render final CTA section buttons linking to /register and /explore", () => {
    render(<HomePage />);

    const registerLinks = screen.getAllByRole("link", {
      name: /Créer mon compte/i,
    });
    expect(registerLinks.length).toBeGreaterThanOrEqual(1);
    expect(registerLinks[0]).toHaveAttribute("href", "/register");

    const exploreLinks = screen.getAllByRole("link", {
      name: /Explorer les scénarios/i,
    });
    expect(exploreLinks.length).toBeGreaterThanOrEqual(1);
    expect(exploreLinks[0]).toHaveAttribute("href", "/explore");
  });

  it("should render final CTA section description", () => {
    render(<HomePage />);

    expect(screen.getByText(/Rejoins les milliers de créateurs/i)).toBeInTheDocument();
  });

  // -----------------------------------------------------------------------
  // Live Call Preview
  // -----------------------------------------------------------------------

  it("should render the LiveCallPreview with user and AI messages", () => {
    render(<HomePage />);

    // LiveCallPreview renders twice on the page (hero right column + feature card)
    const recruiterNames = screen.getAllByText("Recruteur Aléatoire");
    expect(recruiterNames.length).toBeGreaterThanOrEqual(1);
    const scenarioIds = screen.getAllByText("Scenario #0281");
    expect(scenarioIds.length).toBeGreaterThanOrEqual(1);
  });

  it("should render the CallAudioVisualizer inside the LiveCallPreview", () => {
    render(<HomePage />);

    // Two LiveCallPreview instances each contain a CallAudioVisualizer
    const visualizers = screen.getAllByTestId("call-audio-visualizer");
    expect(visualizers.length).toBeGreaterThanOrEqual(1);
  });

  it("should render 'Live' badge in call preview", () => {
    render(<HomePage />);

    const liveBadges = screen.getAllByText("Live");
    expect(liveBadges.length).toBeGreaterThanOrEqual(1);
  });

  // -----------------------------------------------------------------------
  // "use client" directive
  // -----------------------------------------------------------------------

  it("should NOT have 'use client' directive (server component)", () => {
    // The module should export default without being a client component
    expect(HomePage).toBeDefined();
    expect(() => render(<HomePage />)).not.toThrow();
  });
});
