import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// useCreditBalance tests
// ---------------------------------------------------------------------------

const { mockUseQuery, mockUseSession } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

vi.mock("@/lib/trpc", () => ({
  api: {
    billing: {
      getCredits: {
        useQuery: mockUseQuery,
      },
    },
  },
}));

describe("useCreditBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return credits when user is logged in", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
    });

    mockUseQuery.mockReturnValue({
      data: { credits: 150 },
      isLoading: false,
      refetch: vi.fn(),
    });

    const { useCreditBalance } = await import("../useCreditBalance");
    const { result } = renderHook(() => useCreditBalance());

    expect(result.current.credits).toBe(150);
    expect(result.current.isLoading).toBe(false);

    // Verify useQuery was enabled only when session exists
    expect(mockUseQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        enabled: true,
        staleTime: 30000,
      }),
    );
  });

  it("should return 0 credits when user is not logged in", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
    });

    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: vi.fn(),
    });

    const { useCreditBalance } = await import("../useCreditBalance");
    const { result } = renderHook(() => useCreditBalance());

    expect(result.current.credits).toBe(0);
  });

  it("should enable query when session.user exists", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
    });

    mockUseQuery.mockReturnValue({
      data: { credits: 50 },
      isLoading: false,
      refetch: vi.fn(),
    });

    const { useCreditBalance } = await import("../useCreditBalance");
    renderHook(() => useCreditBalance());

    expect(mockUseQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        enabled: true,
      }),
    );
  });

  it("should disable query when session.user is null", async () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "loading",
    });

    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    });

    const { useCreditBalance } = await import("../useCreditBalance");
    renderHook(() => useCreditBalance());

    expect(mockUseQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        enabled: false,
      }),
    );
  });

  it("should pass through refetch function", async () => {
    const mockRefetch = vi.fn();

    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1" } },
      status: "authenticated",
    });

    mockUseQuery.mockReturnValue({
      data: { credits: 100 },
      isLoading: false,
      refetch: mockRefetch,
    });

    const { useCreditBalance } = await import("../useCreditBalance");
    const { result } = renderHook(() => useCreditBalance());

    result.current.refetch();
    expect(mockRefetch).toHaveBeenCalled();
  });
});
