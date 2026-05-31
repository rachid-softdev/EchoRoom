"use client";

import { Skeleton } from "@/components/ui";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";

interface DataLoaderProps<T> {
  query: {
    data: T | undefined
    isLoading: boolean
    isError: boolean
    error?: { message?: string } | null
    refetch: () => void
  }
  children: (data: NonNullable<T>) => React.ReactNode
  empty?: React.ReactNode
  isEmpty?: (data: T) => boolean
  skeletonCount?: number
  skeleton?: React.ReactNode
}

export function DataLoader<T>({
  query,
  children,
  empty,
  isEmpty,
  skeletonCount = 3,
  skeleton,
}: DataLoaderProps<T>) {
  if (query.isLoading) {
    return (
      skeleton ?? (
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className="rounded-xl border border-border p-4 space-y-3"
            >
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg font-semibold mb-2">Une erreur est survenue</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {query.error?.message ??
            'Impossible de charger les données. Réessayez.'}
        </p>
        <Button
          variant="outline"
          onClick={() => query.refetch()}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </Button>
      </div>
    )
  }

  if (!query.data || isEmpty?.(query.data)) {
    return (
      empty ?? (
        <div className="text-center py-16 text-muted-foreground">
          Aucun résultat
        </div>
      )
    );
  }

  return <>{children(query.data as NonNullable<T>)}</>;
}
