import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// DashboardLayout tests — Server Component with auth check + redirect
// ---------------------------------------------------------------------------
// The layout:
//   - Calls auth() from @/lib/auth
//   - Redirects to "/login" if no session
//   - Renders children if authenticated

const mockAuth = vi.fn();

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

// Mock redirect — Next.js redirect() throws a special error to halt rendering
const mockRedirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});
vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
}));

afterEach(() => {
  cleanup();
});

describe("DashboardLayout", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it("redirects to /login when session is null", async () => {
    mockAuth.mockResolvedValue(null);

    const mod = await import("../layout");
    const DashboardLayout = mod.default;

    // Since redirect() throws, we expect the promise to reject
    await expect(DashboardLayout({ children: <div>Protected content</div> })).rejects.toThrow();

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("redirects to /login when session has no user", async () => {
    mockAuth.mockResolvedValue({ expires: "2026-01-01" }); // no user prop

    const mod = await import("../layout");
    const DashboardLayout = mod.default;

    await expect(DashboardLayout({ children: <div>Protected content</div> })).rejects.toThrow();

    expect(mockRedirect).toHaveBeenCalledWith("/login");
  });

  it("renders children when session has a user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u-1", email: "test@test.com" },
      expires: "2026-01-01",
    });

    const mod = await import("../layout");
    const DashboardLayout = mod.default;

    const element = await DashboardLayout({
      children: <div data-testid="protected">Protected content</div>,
    });

    render(element);
    expect(screen.getByTestId("protected")).toBeInTheDocument();
    expect(screen.getByText("Protected content")).toBeInTheDocument();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders children when session has a full user object", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u-1", email: "test@test.com", name: "Test", role: "USER" },
      expires: "2026-01-01",
    });

    const mod = await import("../layout");
    const DashboardLayout = mod.default;

    const element = await DashboardLayout({
      children: <span>Dashboard content</span>,
    });

    render(element);
    expect(screen.getByText("Dashboard content")).toBeInTheDocument();
  });
});
