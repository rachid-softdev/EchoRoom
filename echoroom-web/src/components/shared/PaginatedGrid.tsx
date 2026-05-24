'use client'

import { Button } from '@/components/ui'
import { Loader2, ArrowDown } from 'lucide-react'

interface PaginatedGridProps {
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  children: React.ReactNode
}

export function PaginatedGrid({
  hasMore,
  isLoadingMore,
  onLoadMore,
  children,
}: PaginatedGridProps) {
  return (
    <div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {children}
      </div>
      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
            Voir plus
          </Button>
        </div>
      )}
    </div>
  )
}
