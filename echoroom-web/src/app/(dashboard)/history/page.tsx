"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { Clock, Phone, Search, X } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { CallHistoryRow } from "@/components/shared/CallHistoryRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedDataLoader } from "@/components/shared/PaginatedDataLoader";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/trpc";

interface CallItem {
  id: string;
  status: string;
  durationSeconds: number;
  createdAt: string | Date;
  scenario?: {
    title: string;
    character?: { name: string };
  };
}

export default function HistoryPage() {
  const [search, setSearch] = useState("");

  const paginated = usePaginatedQuery(
    // biome-ignore lint/correctness/useHookAtTopLevel: usePaginatedQuery lazily invokes the tRPC hook inside its body — this is a valid pattern
    (args) => api.calls.history.useQuery(args),
    { limit: 20 },
  );

  const filteredItems = useMemo(() => {
    if (!search.trim()) return paginated.items;
    const q = search.toLowerCase();
    return paginated.items.filter((item) => {
      const call = item as CallItem;
      return (
        call.scenario?.title?.toLowerCase().includes(q) ||
        call.scenario?.character?.name?.toLowerCase().includes(q) ||
        call.status?.toLowerCase().includes(q)
      );
    });
  }, [paginated.items, search]);

  const hasSearch = search.trim().length > 0;

  return (
    <DashboardShell
      title="Historique des appels"
      subtitle="Consultez vos appels passés et réécoutez vos meilleurs moments"
    >
      {/* Search bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Rechercher par scénario, personnage ou statut..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 pr-9"
          aria-label="Rechercher dans l'historique"
        />
        {hasSearch && (
          <button
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
            icon={Clock}
            title="Aucun appel pour le moment"
            description="Lancez votre premier appel pour voir votre historique ici."
            action={
              <Link href="/create">
                <Button className="gap-2">
                  <Phone className="w-4 h-4" />
                  Créer un appel
                </Button>
              </Link>
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
                  Aucun appel ne correspond à &laquo;&nbsp;{search}&nbsp;&raquo;
                </p>
              </div>
            );
          }

          return (
            <>
              <div className="space-y-2">
                {filteredItems.map((call) => {
                  const item = call as CallItem;
                  return <CallHistoryRow key={item.id} call={item} />;
                })}
              </div>
              {paginated.hasMore && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={paginated.loadMore}
                    disabled={paginated.isFetchingMore}
                  >
                    {paginated.isFetchingMore ? "Chargement..." : "Voir plus"}
                  </Button>
                </div>
              )}
            </>
          );
        }}
      </PaginatedDataLoader>
    </DashboardShell>
  );
}
