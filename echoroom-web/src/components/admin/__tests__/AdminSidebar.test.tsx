import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

import { usePathname } from "next/navigation";
import { AdminSidebar } from "../AdminSidebar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AdminSidebar", () => {
  it("renders all nav items", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/moderation");

    render(<AdminSidebar />);

    expect(screen.getByText("Modération")).toBeInTheDocument();
    expect(screen.getByText("Signalements")).toBeInTheDocument();
    expect(screen.getByText("Journal d'audit")).toBeInTheDocument();
    expect(screen.getByText("Numéros bloqués")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
    expect(screen.getByText("Analytiques")).toBeInTheDocument();
  });

  it("highlights active route", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/moderation");

    render(<AdminSidebar />);

    const moderationLink = screen.getByText("Modération").closest("a");
    expect(moderationLink).toHaveAttribute("aria-current", "page");
  });

  it("does not set aria-current on inactive links", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/analytics");

    render(<AdminSidebar />);

    // Moderation link should not have aria-current
    const moderationLink = screen.getByText("Modération").closest("a");
    expect(moderationLink).not.toHaveAttribute("aria-current");

    // Analytics link should have aria-current
    const analyticsLink = screen.getByText("Analytiques").closest("a");
    expect(analyticsLink).toHaveAttribute("aria-current", "page");
  });

  it("renders EchoRoom Admin branding", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/moderation");

    render(<AdminSidebar />);

    expect(screen.getByText("EchoRoom Admin")).toBeInTheDocument();
  });

  it("renders correct href for each nav link", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/moderation");

    render(<AdminSidebar />);

    const links = [
      { label: "Modération", href: "/admin/moderation" },
      { label: "Signalements", href: "/admin/reports" },
      { label: "Journal d'audit", href: "/admin/audit" },
      { label: "Numéros bloqués", href: "/admin/blocked-numbers" },
      { label: "Utilisateurs", href: "/admin/users" },
      { label: "Analytiques", href: "/admin/analytics" },
    ];

    for (const { label, href } of links) {
      const link = screen.getByText(label).closest("a");
      expect(link).toHaveAttribute("href", href);
    }
  });

  it("renders the ThemeToggle component", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/admin/moderation");

    render(<AdminSidebar />);

    // ThemeToggle renders a button with aria-label for theme
    expect(screen.getByRole("button", { name: /thème|theme|mode/i })).toBeInTheDocument();
  });

  it("handles undefined pathname gracefully", () => {
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    render(<AdminSidebar />);

    // Should still render all nav items without active state
    expect(screen.getByText("Modération")).toBeInTheDocument();
    expect(screen.getByText("Utilisateurs")).toBeInTheDocument();
  });
});
