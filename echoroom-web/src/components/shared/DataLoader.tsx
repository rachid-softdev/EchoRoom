"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Skeleton } from "@echoroom/ui";

/**
 * Generic query result shape accepted by DataLoader.
 * @property data - The resolved data payload, undefined while loading
 * @property isLoading - Whether the query is in flight
 * @property isError - Whether the query failed
 * @property error - Optional error object with a message
 * @property refetch - Function to re-run the query
 */
interface DataLoaderProps<T> {
  query: {
    data: T | undefined;
    isLoading: boolean;
    isError: boolean;
    error?: { message?: string } | null;
    refetch: () => void;
  };
  /** Render function called with non-null data when loaded */
  children: (data: NonNullable<T>) => React.ReactNode;
  /** Custom empty state content (replaces the default "Aucun résultat") */
  empty?: React.ReactNode;
  /** Custom function to determine if data is considered empty */
  isEmpty?: (data: T) => boolean;
  /** Number of skeleton placeholders to show while loading (default 3) */
  skeletonCount?: number;
  /** Custom skeleton content (replaces the default grid of skeletons) */
  skeleton?: React.ReactNode;
}

/**
 * A generic data-loading component handling loading, error, and empty states.
 *
 * @description Wraps a TanStack Query-like result object and renders the
 * appropriate UI: a skeleton placeholder while loading, an error view with a
 * retry button on failure, an empty state when data is absent (or passes an
 * optional isEmpty check), or the children render function with the resolved
 * data.
 * @example
 * <DataLoader query={trpcQuery} isEmpty={(d) => d.items.length === 0}>
 *   {(data) => <List items={data.items} />}
 * </DataLoader>
 * @returns A React node for loading, error, empty, or the children output
 */
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
            <div key={`skel-${i}`} className="rounded-xl border border-border p-4 space-y-3">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      )
    );
  }

  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
        <p className="text-lg font-semibold mb-2">Une erreur est survenue</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {query.error?.message ?? "Impossible de charger les données. Réessayez."}
        </p>
        <Button variant="outline" onClick={() => query.refetch()} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (!query.data || isEmpty?.(query.data)) {
    return empty ?? <div className="text-center py-16 text-muted-foreground">Aucun résultat</div>;
  }

  return <>{children(query.data as NonNullable<T>)}</>;
}
