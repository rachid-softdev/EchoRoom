'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
}

/**
 * Simple cursor-based pagination hook.
 * Works with any tRPC query that returns { items: T[], nextCursor?: string }.
 * 
 * FIXED: Uses useEffect to accumulate items when query.data changes,
 * avoiding stale closure issues in loadMore.
 */
export function usePaginatedQuery<T, TArgs extends Record<string, unknown>>(
  fetcher: (args: TArgs) => {
    data?: PaginatedResult<T>
    isLoading: boolean
    isFetching?: boolean
    isError: boolean
    error?: { message?: string } | null
    refetch: (opts?: Record<string, unknown>) => void
  },
  initialArgs: Omit<TArgs, 'cursor'> & { limit: number },
) {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<T[]>([])
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const lastDataRef = useRef<PaginatedResult<T> | undefined>(undefined)

  const query = fetcher({
    ...initialArgs,
    cursor,
  } as unknown as TArgs)

  const nextCursor = query.data?.nextCursor

  // Accumulate items when data changes (new page loaded)
  useEffect(() => {
    const data = query.data
    if (!data) return

    // Skip if data hasn't changed (prevents duplicate accumulation)
    if (lastDataRef.current === data) return
    lastDataRef.current = data

    if (!cursor) {
      // First page: replace all items
      setAllItems(data.items)
    } else {
      // Subsequent pages: append only new items (dedup by id if available)
      setAllItems((prev) => {
        const existingIds = new Set(
          prev.map((item) => (item as Record<string, unknown>).id as string).filter(Boolean)
        )
        const newItems = data.items.filter(
          (item) => !existingIds.has((item as Record<string, unknown>).id as string)
        )
        return [...prev, ...newItems]
      })
    }

    setIsFetchingMore(false)
  }, [query.data, cursor])

  const loadMore = useCallback(() => {
    if (!nextCursor || isFetchingMore || query.isLoading) return
    setIsFetchingMore(true)
    setCursor(nextCursor)
  }, [nextCursor, isFetchingMore, query.isLoading])

  const refetch = useCallback(() => {
    setCursor(undefined)
    setAllItems([])
    setIsFetchingMore(false)
    lastDataRef.current = undefined
    query.refetch()
  }, [query.refetch])

  return {
    items: allItems,
    isLoading: query.isLoading && allItems.length === 0,
    isFetchingMore,
    isError: query.isError,
    error: query.error,
    hasMore: !!nextCursor,
    loadMore,
    refetch,
  }
}
