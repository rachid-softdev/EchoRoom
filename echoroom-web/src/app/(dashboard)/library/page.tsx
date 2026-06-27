"use client";

import { Library as LibraryIcon, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedDataLoader } from "@/components/shared/PaginatedDataLoader";
import { PaginatedGrid } from "@/components/shared/PaginatedGrid";
import { ScenarioCard, type ScenarioCardData } from "@/components/shared/ScenarioCard";
import { Button, Input } from "@/components/ui";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/trpc";

export default function LibraryPage() {
  const [search, setSearch] = useState("");

  const paginated = usePaginatedQuery(
    // biome-ignore lint/correctness/useHookAtTopLevel: usePaginatedQuery lazily invokes the tRPC hook inside its body — this is a valid pattern
    (args) => api.scenarios.myScenarios.useQuery(args),
    { limit: 20 },
  );

  const filteredItems = useMemo(() => {
    if (!search.trim()) return paginated.items;
    const q = search.toLowerCase();
    return paginated.items.filter((item) => {
      const s = item as ScenarioCardData;
      return (
        s.title?.toLowerCase().includes(q) ||
        s.character?.name?.toLowerCase().includes(q) ||
        s.creator?.username?.toLowerCase().includes(q)
      );
    }) as ScenarioCardData[];
  }, [paginated.items, search]);

  const hasSearch = search.trim().length > 0;

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
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher par titre, personnage ou créateur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Rechercher dans la bibliothèque"
        />
        {hasSearch && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Effacer la recherche"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

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
        {() => {
          if (hasSearch && filteredItems.length === 0) {
            return (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">Aucun résultat</p>
                <p className="text-xs text-muted-foreground">
                  Aucun scénario ne correspond à &laquo;&nbsp;{search}&nbsp;&raquo;
                </p>
              </div>
            );
          }

          return (
            <PaginatedGrid
              hasMore={paginated.hasMore}
              isLoadingMore={paginated.isFetchingMore}
              onLoadMore={paginated.loadMore}
            >
              {filteredItems.map((scenario) => (
                <ScenarioCard
                  key={(scenario as ScenarioCardData).id}
                  scenario={scenario as ScenarioCardData}
                />
              ))}
            </PaginatedGrid>
          );
        }}
      </PaginatedDataLoader>
    </DashboardShell>
  );
}
