'use client'

import { useState, useCallback } from 'react'

interface PaginatedResult<T> {
  items: T[]
  nextCursor?: string
}

/**
 * Simple cursor-based pagination hook.
 * Works with any tRPC query that returns { items: T[], nextCursor?: string }.
 */
export function usePaginatedQuery<T, TArgs extends Record<string, unknown>>(
  fetcher: (args: TArgs) => {
    data?: PaginatedResult<T>
    isLoading: boolean
    isError: boolean
    error?: { message?: string }
    refetch: (opts?: Record<string, unknown>) => void
  },
  initialArgs: Omit<TArgs, 'cursor'> & { limit: number },
) {
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [allItems, setAllItems] = useState<T[]>([])
  const [isFetchingMore, setIsFetchingMore] = useState(false)

  const query = fetcher({
    ...initialArgs,
    cursor,
  } as unknown as TArgs)

  // Accumulate items as new pages load
  const items = query.data?.items ?? []
  const nextCursor = query.data?.nextCursor
  const hasMore = !!nextCursor

  const loadMore = useCallback(() => {
    if (!nextCursor || isFetchingMore || query.isLoading) return

    setIsFetchingMore(true)
    setCursor(nextCursor)
    setAllItems((prev) => [...prev, ...items])
    setIsFetchingMore(false)
  }, [nextCursor, isFetchingMore, query.isLoading, items])

  return {
    items: allItems.length > 0 ? allItems : items,
    isLoading: query.isLoading && allItems.length === 0,
    isError: query.isError,
    error: query.error,
    hasMore,
    isFetchingMore,
    loadMore,
    refetch: () => {
      setCursor(undefined)
      setAllItems([])
      query.refetch()
    },
  }
}
