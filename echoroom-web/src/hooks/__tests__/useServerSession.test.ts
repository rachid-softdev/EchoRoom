import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// useServerSession tests
// ---------------------------------------------------------------------------
// Tests for src/hooks/useServerSession.ts which fetches session data from
// /api/auth/session on mount.

describe("useServerSession", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return user when authenticated", async () => {
    const mockSession = {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
        role: "USER",
      },
      expires: "2026-07-20T00:00:00.000Z",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockSession),
    });

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockSession.user);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("should return null when no session", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    });

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should start with isLoading true and become false after fetch", async () => {
    // Create a deferred promise to control timing
    let resolveFetch: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    mockFetch.mockReturnValue(fetchPromise);

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    // Immediately after render, isLoading should be true
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeNull();

    // Resolve the fetch
    await act(async () => {
      resolveFetch!({
        ok: true,
        json: vi.fn().mockResolvedValue({ user: { id: "1", name: "A" } }),
      });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual({ id: "1", name: "A" });
  });

  it("should handle network error — user null, isLoading false", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should handle non-200 response — user null", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn(),
    });

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it("should fetch from '/api/auth/session'", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    });

    const { useServerSession } = await import("../useServerSession");
    renderHook(() => useServerSession());

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/auth/session");
    });
  });

  it("should return empty user object as user when session has empty user", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        user: {},
        expires: "2026-07-20T00:00:00.000Z",
      }),
    });

    const { useServerSession } = await import("../useServerSession");
    const { result } = renderHook(() => useServerSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // session?.user ?? null — empty object {} is truthy, so returned as-is
    expect(result.current.user).toEqual({});
    expect(result.current.isAuthenticated).toBe(true);
  });
});
