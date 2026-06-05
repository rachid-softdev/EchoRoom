import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// usePaginatedQuery tests
// ---------------------------------------------------------------------------
// Hook manages cursor-based pagination with item accumulation and dedup.
// Uses a controlled mock fetcher that returns pre-defined pages based on cursor.

interface MockItem {
  id: string;
  name: string;
}

describe("usePaginatedQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return initial items on first page", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: {
        items: [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" },
        ],
        nextCursor: "cursor-2",
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.items).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it("should call fetcher with initial args including limit", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: { items: [{ id: "1", name: "A" }], nextCursor: undefined },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 25, category: "chat" }),
    );

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });

    // Should pass limit and extra args, cursor should be undefined for first page
    const callArg = fetcher.mock.calls[0]![0] as Record<string, unknown>;
    expect(callArg["limit"]).toBe(25);
    expect(callArg["category"]).toBe("chat");
    // cursor may or may not be present depending on implementation
  });

  it("should accumulate items when loadMore is called", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    let callCount = 0;

    const pages: Record<string, { items: MockItem[]; nextCursor?: string }> = {
      "undefined": {
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: "cursor-2",
      },
      "cursor-2": {
        items: [{ id: "2", name: "Item 2" }],
      },
    };

    const fetcher = vi.fn().mockImplementation((args: Record<string, unknown>) => {
      callCount++;
      // Determine which page to return based on cursor
      const cursorKey = String(args["cursor"] ?? "undefined");
      const pageData = pages[cursorKey] ?? pages["undefined"];

      return {
        data: pageData,
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    // First page loads
    await waitFor(() => {
      expect(result.current.items).toEqual([{ id: "1", name: "Item 1" }]);
    });

    expect(result.current.hasMore).toBe(true);

    // Load more
    await act(async () => {
      result.current.loadMore();
    });

    // Second page accumulates
    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    expect(result.current.items).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
    ]);
    expect(result.current.hasMore).toBe(false);
  });

  it("should deduplicate items by id when appending", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const pages: Record<string, { items: MockItem[]; nextCursor?: string }> = {
      "undefined": {
        items: [
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" },
        ],
        nextCursor: "cursor-2",
      },
      "cursor-2": {
        items: [
          { id: "2", name: "Item 2" }, // Duplicate
          { id: "3", name: "Item 3" }, // New
        ],
      },
    };

    const fetcher = vi.fn().mockImplementation((args: Record<string, unknown>) => {
      const cursorKey = String(args["cursor"] ?? "undefined");
      return {
        data: pages[cursorKey] ?? pages["undefined"],
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    // Load more
    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    expect(result.current.items).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
    ]);
  });

  it("should handle empty first page", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: { items: [], nextCursor: undefined },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    expect(result.current.hasMore).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("should indicate no more pages when nextCursor is undefined", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: {
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: undefined,
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });

    // loadMore should do nothing since hasMore is false
    await act(async () => {
      result.current.loadMore();
    });

    expect(result.current.items).toHaveLength(1);
  });

  it("should show isLoading when no items and query is loading", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
  });

  it("should show isLoading false when items already loaded", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: {
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: "cursor-2",
      },
      isLoading: true, // Still loading but have data
      isFetching: true,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.items).toHaveLength(1);
  });

  it("should reflect error state from query", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: { message: "Something went wrong" },
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe("Something went wrong");
    expect(result.current.items).toEqual([]);
  });

  it("should reset pagination on refetch", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const refetchMock = vi.fn();
    const fetcher = vi.fn().mockReturnValue({
      data: {
        items: [{ id: "1", name: "Item 1" }],
        nextCursor: "cursor-2",
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: refetchMock,
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    // Refetch
    await act(async () => {
      result.current.refetch();
    });

    // Refetch should call the query's refetch
    expect(refetchMock).toHaveBeenCalled();
  });

  it("should not throw when items have no id field for dedup", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const pages: Record<string, { items: Record<string, unknown>[]; nextCursor?: string }> = {
      "undefined": {
        items: [{ name: "A", value: 1 }],
        nextCursor: "cursor-2",
      },
      "cursor-2": {
        items: [{ id: "2", name: "Item 2" }],
      },
    };

    const fetcher = vi.fn().mockImplementation((args: Record<string, unknown>) => {
      const cursorKey = String(args["cursor"] ?? "undefined");
      return {
        data: pages[cursorKey] ?? pages["undefined"],
        isLoading: false,
        isFetching: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    // Load first additional page
    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(2);
    });

    // Load second additional page
    await act(async () => {
      result.current.loadMore();
    });

    // Items should eventually accumulate to 3
    await waitFor(() => {
      expect(result.current.items).toHaveLength(3);
    });

    expect(result.current.items).toEqual([
      { id: "1", name: "Item 1" },
      { id: "2", name: "Item 2" },
      { id: "3", name: "Item 3" },
    ]);
  });

  it("should work with empty data (undefined items)", async () => {
    const { usePaginatedQuery } = await import("../usePaginatedQuery");

    const fetcher = vi.fn().mockReturnValue({
      data: { items: [], nextCursor: undefined },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePaginatedQuery(fetcher, { limit: 10 }),
    );

    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });

    expect(result.current.hasMore).toBe(false);
  });
});
