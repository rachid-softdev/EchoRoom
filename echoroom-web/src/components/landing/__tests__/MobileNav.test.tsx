import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// MobileNav tests — burger menu button renders and toggles mobile nav
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock("@/components/ui", () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock("lucide-react", () => ({
  Menu: () => <svg data-testid="menu-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

afterEach(() => {
  cleanup();
});

describe("MobileNav", () => {
  let MobileNav: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../MobileNav");
    MobileNav = mod.MobileNav;
  });

  it("renders the burger menu button with aria-label", () => {
    render(<MobileNav />);

    const button = screen.getByRole("button", { name: /menu/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Menu");
  });

  it("shows Menu icon (hamburger) when menu is closed", () => {
    render(<MobileNav />);

    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("x-icon")).not.toBeInTheDocument();
  });

  it("does not show the mobile menu links by default", () => {
    render(<MobileNav />);

    expect(screen.queryByText("Explorer")).not.toBeInTheDocument();
    expect(screen.queryByText("Tarifs")).not.toBeInTheDocument();
    expect(screen.queryByText("Connexion")).not.toBeInTheDocument();
  });

  it("toggles the mobile menu when burger button is clicked", async () => {
    render(<MobileNav />);

    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /menu/i });

    // Click to open
    await user.click(button);
    expect(screen.getByText("Explorer")).toBeInTheDocument();
    expect(screen.getByText("Tarifs")).toBeInTheDocument();
    expect(screen.getByText("Connexion")).toBeInTheDocument();
    expect(screen.getByText("S'inscrire")).toBeInTheDocument();

    // Click to close — button now shows X icon
    expect(screen.getByTestId("x-icon")).toBeInTheDocument();

    await user.click(button);
    expect(screen.queryByText("Explorer")).not.toBeInTheDocument();
    expect(screen.queryByTestId("x-icon")).not.toBeInTheDocument();
    expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
  });

  it("contains links to /explore, /pricing, /login, and /register", async () => {
    render(<MobileNav />);

    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: /menu/i });
    await user.click(button);

    const exploreLink = screen.getByText("Explorer").closest("a");
    expect(exploreLink).toHaveAttribute("href", "/explore");

    const pricingLink = screen.getByText("Tarifs").closest("a");
    expect(pricingLink).toHaveAttribute("href", "/pricing");

    const loginLink = screen.getByText("Connexion").closest("a");
    expect(loginLink).toHaveAttribute("href", "/login");

    const registerLink = screen.getByText("S'inscrire").closest("a");
    expect(registerLink).toHaveAttribute("href", "/register");
  });
});
