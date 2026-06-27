import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// LegalLayout tests — Server Component with nav bar, content area, and footer
// ---------------------------------------------------------------------------
// The layout renders:
//   - Sticky nav bar with back-to-home link and EchoRoom brand
//   - Content area for children
//   - Footer with copyright and links to /help, /privacy, /terms

// Mock next/link — renders a plain <a> element
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react icons used in the layout
vi.mock("lucide-react", () => ({
  ArrowLeft: ({ className, ...props }: any) => (
    <svg data-testid="icon-arrow-left" className={className} {...props} />
  ),
  Phone: ({ className, ...props }: any) => (
    <svg data-testid="icon-phone" className={className} {...props} />
  ),
}));

afterEach(() => {
  cleanup();
});

describe("LegalLayout", () => {
  let LegalLayout: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../layout");
    LegalLayout = mod.default;
  });

  // --- Navigation bar ---

  it("renders a navigation bar", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
  });

  it("renders the back-to-home link with correct href", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const backLink = screen.getByRole("link", { name: /retour à l'accueil/i });
    expect(backLink).toBeInTheDocument();
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("renders the arrow-left icon in the back link", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const arrowIcon = document.querySelector('[data-testid="icon-arrow-left"]');
    expect(arrowIcon).toBeInTheDocument();
  });

  it("renders the EchoRoom brand link with correct href", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const brandLinks = screen.getAllByRole("link", { name: /EchoRoom/i });
    // The brand link with the Phone icon
    const brandLink = brandLinks.find((link) => link.getAttribute("href") === "/");
    expect(brandLink).toBeInTheDocument();
    expect(brandLink).toHaveAttribute("href", "/");
  });

  it("renders the phone icon next to the brand name", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const phoneIcon = document.querySelector('[data-testid="icon-phone"]');
    expect(phoneIcon).toBeInTheDocument();
  });

  it("displays the brand name 'EchoRoom' in the nav", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    expect(screen.getByText("EchoRoom")).toBeInTheDocument();
  });

  it("renders the navigation with sticky positioning classes", () => {
    const { container } = render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const nav = container.querySelector("nav");
    expect(nav).toBeInTheDocument();
    expect(nav?.className).toContain("sticky");
    expect(nav?.className).toContain("top-0");
    expect(nav?.className).toContain("z-50");
  });

  // --- Footer ---

  it("renders a footer", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const footer = document.querySelector("footer");
    expect(footer).toBeInTheDocument();
  });

  it("renders the copyright notice with the current year", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} EchoRoom AI`))).toBeInTheDocument();
  });

  it("renders the 'Aide' footer link pointing to /help", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const link = screen.getByRole("link", { name: /Aide/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/help");
  });

  it("renders the 'Confidentialité' footer link pointing to /privacy", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const link = screen.getByRole("link", { name: /Confidentialité/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/privacy");
  });

  it("renders the 'Conditions' footer link pointing to /terms", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const link = screen.getByRole("link", { name: /Conditions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/terms");
  });

  it("renders the footer with border-top class", () => {
    const { container } = render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const footer = container.querySelector("footer");
    expect(footer?.className).toContain("border-t");
  });

  // --- Child rendering ---

  it("renders children correctly", () => {
    render(
      <LegalLayout>
        <div data-testid="child">Legal page content</div>
      </LegalLayout>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Legal page content")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <LegalLayout>
        <span data-testid="child-1">First</span>
        <span data-testid="child-2">Second</span>
      </LegalLayout>,
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("wraps children in a responsive content container", () => {
    const { container } = render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    // The content div is a direct child of the root div, after the nav
    // It should have the responsive spacing classes
    const contentDiv = container.querySelector("div > div.max-w-4xl.mx-auto.px-6");
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv?.className).toContain("py-12");
  });

  // --- Accessibility ---

  it("has a semantic nav landmark", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const nav = document.querySelector("nav");
    expect(nav).toBeInTheDocument();
    // Nav should be a landmark when it has an aria-label or is the only nav
    // The implicit landmark is sufficient here
  });

  it("has a semantic footer landmark", () => {
    render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const footer = document.querySelector("footer");
    expect(footer).toBeInTheDocument();
  });

  // --- Responsive structure ---

  it("uses a max-width container for layout consistency", () => {
    const { container } = render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    // Both nav and footer use max-w-4xl
    const navDiv = container.querySelector("nav > div");
    const footerDiv = container.querySelector("footer > div");

    expect(navDiv?.className).toContain("max-w-4xl");
    expect(footerDiv?.className).toContain("max-w-4xl");
  });

  it("applies px-6 padding consistently across nav, content, and footer", () => {
    const { container } = render(
      <LegalLayout>
        <div>Content</div>
      </LegalLayout>,
    );

    const navDiv = container.querySelector("nav > div");
    const contentDiv = container.querySelector("div > div.max-w-4xl");
    const footerDiv = container.querySelector("footer > div");

    expect(navDiv?.className).toContain("px-6");
    expect(contentDiv?.className).toContain("px-6");
    expect(footerDiv?.className).toContain("px-6");
  });
});
