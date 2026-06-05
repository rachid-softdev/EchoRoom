"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { Library as LibraryIcon, Plus } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { PaginatedGrid } from "@/components/shared/PaginatedGrid";
import { ScenarioCard, type ScenarioCardData } from "@/components/shared/ScenarioCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedDataLoader } from "@/components/shared/PaginatedDataLoader";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/trpc";

export default function LibraryPage() {
  const paginated = usePaginatedQuery(
    (args) => api.scenarios.myScenarios.useQuery(args),
    { limit: 20 },
  );

  return (
    <DashboardShell
      title="Bibliothèque"
      subtitle="Vos scénarios sauvegardés et vos créations"
      actions={
        <Link href="/create">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Nouveau
          </Button>
        </Link>
      }
    >
      <PaginatedDataLoader
        query={paginated}
        empty={
          <EmptyState
            icon={LibraryIcon}
            title="Bibliothèque vide"
            description="Créez votre premier scénario ou explorez la communauté pour trouver l'inspiration."
            action={
              <div className="flex gap-3 justify-center">
                <Link href="/create">
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Créer un scénario
                  </Button>
                </Link>
                <Link href="/explore">
                  <Button variant="outline">Explorer</Button>
                </Link>
              </div>
            }
          />
        }
      >
        {(items) => (
          <PaginatedGrid
            hasMore={paginated.hasMore}
            isLoadingMore={paginated.isFetchingMore}
            onLoadMore={paginated.loadMore}
          >
            {items.map((scenario) => (
              <ScenarioCard key={(scenario as { id: string }).id} scenario={scenario as ScenarioCardData} />
            ))}
          </PaginatedGrid>
        )}
      </PaginatedDataLoader>
    </DashboardShell>
  );
}
