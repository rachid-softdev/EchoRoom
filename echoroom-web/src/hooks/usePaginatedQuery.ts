"use client";

import { useState, useCallback, useEffect, useRef } from "react";

interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

interface UsePaginatedQueryOptions<T> {
  getKey?: (item: T) => string | number;
}

export function usePaginatedQuery<T, TArgs extends Record<string, unknown>>(
  fetcher: (args: TArgs) => {
    data?: PaginatedResult<T>;
    isLoading: boolean;
    isFetching?: boolean;
    isError: boolean;
    error?: { message?: string } | null;
    refetch: (opts?: Record<string, unknown>) => void;
  },
  initialArgs: Omit<TArgs, "cursor"> & { limit: number },
  options?: UsePaginatedQueryOptions<T>,
) {
  const getKey =
    options?.getKey ??
    ((item: T) =>
      (item as unknown as Record<string, unknown>).id as string);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<T[]>([]);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const lastDataRef = useRef<PaginatedResult<T> | undefined>(undefined);

  const nextCursorRef = useRef<string | undefined>(undefined);
  const isFetchingMoreRef = useRef(false);
  const isLoadingRef = useRef(false);

  const query = fetcher({
    ...initialArgs,
    cursor,
  } as unknown as TArgs);

  const nextCursor = query.data?.nextCursor;

  nextCursorRef.current = nextCursor;
  isFetchingMoreRef.current = isFetchingMore;
  isLoadingRef.current = query.isLoading;

  useEffect(() => {
    const data = query.data;
    if (!data) return;
    if (lastDataRef.current === data) return;
    lastDataRef.current = data;

    if (!cursor) {
      setAllItems(data.items);
    } else {
      setAllItems((prev) => {
        const existingKeys = new Set(prev.map(getKey));
        const newItems = data.items.filter(
          (item) => !existingKeys.has(getKey(item)),
        );
        return [...prev, ...newItems];
      });
    }

    setIsFetchingMore(false);
  }, [query.data, cursor, getKey]);

  const loadMore = useCallback(() => {
    if (
      !nextCursorRef.current ||
      isFetchingMoreRef.current ||
      isLoadingRef.current
    )
      return;
    setIsFetchingMore(true);
    setCursor(nextCursorRef.current);
  }, []);

  const refetch = useCallback(() => {
    setCursor(undefined);
    setAllItems([]);
    setIsFetchingMore(false);
    lastDataRef.current = undefined;
    query.refetch();
  }, [query.refetch]);

  return {
    items: allItems,
    isLoading: query.isLoading && allItems.length === 0,
    isFetchingMore,
    isError: query.isError,
    error: query.error,
    hasMore: !!nextCursor,
    loadMore,
    refetch,
  };
}
