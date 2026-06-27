import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// useUser hook tests
// ---------------------------------------------------------------------------
// Tests for src/hooks/index.ts which wraps next-auth's useSession to provide
// user, isLoading, and isAuthenticated.

const mockUseSession = vi.hoisted(() => vi.fn());

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

describe("useUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return user when session has user and status is authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          role: "USER",
        },
      },
      status: "authenticated",
    });

    const { useUser } = await import("../index");
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toEqual({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role: "USER",
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should return loading state when status is loading", async () => {
    mockUseSession.mockReturnValue({
      data: undefined,
      status: "loading",
    });

    const { useUser } = await import("../index");
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should return unauthenticated when status is unauthenticated", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    const { useUser } = await import("../index");
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should have isAuthenticated false when session has no user (bug fix)", async () => {
    // Edge case: status is "authenticated" but session.user is null/undefined
    mockUseSession.mockReturnValue({
      data: { user: null },
      status: "authenticated",
    });

    const { useUser } = await import("../index");
    const { result } = renderHook(() => useUser());

    // session.user is null, so user should be null
    expect(result.current.user).toBeNull();
    // isAuthenticated should be:
    // status === "authenticated" && !!session?.user
    // !!null is false → isAuthenticated should be false
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should have isAuthenticated false when session is null but status is authenticated", async () => {
    // This shouldn't happen in practice, but tests the guard
    mockUseSession.mockReturnValue({
      data: null,
      status: "authenticated",
    });

    const { useUser } = await import("../index");
    const { result } = renderHook(() => useUser());

    expect(result.current.user).toBeNull();
    // session?.user is null → !!null = false → isAuthenticated is false
    expect(result.current.isAuthenticated).toBe(false);
  });
});
