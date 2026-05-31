"use client";

import type { ReactNode } from "react";
import { Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

interface PaginatedQueryResult<T> {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  error?: { message?: string } | null;
  refetch: () => void;
}

interface PaginatedDataLoaderProps<T> {
  query: PaginatedQueryResult<T>;
  children: (items: T[]) => ReactNode;
  empty?: ReactNode;
  loadingSkeleton?: ReactNode;
}

export function PaginatedDataLoader<T>({
  query,
  children,
  empty,
  loadingSkeleton,
}: PaginatedDataLoaderProps<T>) {
  if (query.isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
        <p className="text-lg font-semibold mb-2">Une erreur est survenue</p>
        <p className="text-sm text-muted-foreground mb-4">
          {query.error?.message ?? "Impossible de charger les données"}
        </p>
        <Button variant="outline" onClick={() => query.refetch()} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      loadingSkeleton ?? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )
    );
  }

  if (query.items.length === 0) {
    return <>{empty}</>;
  }

  return <>{children(query.items)}</>;
}
