import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock AdminSidebar
vi.mock("@/components/admin/AdminSidebar", () => ({
  AdminSidebar: () => <aside data-testid="admin-sidebar" />,
}));

// Mock next/link (used by AdminSidebar)
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/moderation"),
}));

// Mock lucide-react (used by AdminSidebar mock might not need it, but jest hoisting requires)
vi.mock("lucide-react", () => ({
  Shield: () => <svg data-testid="icon-shield" />,
  Flag: () => <svg data-testid="icon-flag" />,
  ScrollText: () => <svg data-testid="icon-scroll-text" />,
  Ban: () => <svg data-testid="icon-ban" />,
  Users: () => <svg data-testid="icon-users" />,
  BarChart3: () => <svg data-testid="icon-bar-chart" />,
  LayoutDashboard: () => <svg data-testid="icon-layout-dashboard" />,
}));

vi.mock("@/components/ui/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle">Theme</button>,
}));

vi.mock("@/components/ui", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

afterEach(() => {
  cleanup();
});

describe("AdminLayout", () => {
  let AdminLayout: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../layout");
    AdminLayout = mod.default;
  });

  it("renders the AdminSidebar", () => {
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId("admin-sidebar")).toBeInTheDocument();
  });

  it("renders children in the main content area", () => {
    render(
      <AdminLayout>
        <div data-testid="child-content">Admin Content</div>
      </AdminLayout>,
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Admin Content")).toBeInTheDocument();
  });

  it("renders layout with flex container", () => {
    const { container } = render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const flexContainer = container.firstChild as HTMLElement;
    expect(flexContainer).toBeInTheDocument();
    expect(flexContainer.className).toContain("flex");
    expect(flexContainer.className).toContain("min-h-screen");
  });

  it("renders the main element with correct classes", () => {
    render(
      <AdminLayout>
        <div>Content</div>
      </AdminLayout>,
    );

    const main = document.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main?.className).toContain("flex-1");
    expect(main?.className).toContain("p-6");
    expect(main?.className).toContain("bg-background");
  });
});
