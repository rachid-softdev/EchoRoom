"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Library as LibraryIcon, Plus } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataLoader } from "@/components/shared/DataLoader";
import { PaginatedGrid } from "@/components/shared/PaginatedGrid";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/trpc";

interface ScenarioItem {
  id: string
  title: string
  description: string
  character?: { name: string; slug?: string }
  creator?: { username: string }
  _count?: { reactions: number; comments: number }
  playCount?: number
  visibility?: string
}

export default function LibraryPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<ScenarioItem[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const myScenariosData = api.scenarios.myScenarios.useQuery(
    { limit: 20, cursor },
  );

  const myScenarios = myScenariosData.data;

  useEffect(() => {
    if (myScenarios) {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = myScenarios.items.filter((i) => !existingIds.has(i.id));
        return cursor ? [...prev, ...newItems] : newItems;
      });
      setHasMore(!!myScenarios.nextCursor);
    }
  }, [myScenarios, cursor]);

  const handleLoadMore = useCallback(() => {
    if (myScenarios?.nextCursor) {
      setCursor(myScenarios.nextCursor);
    }
  }, [myScenarios?.nextCursor]);

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
      <DataLoader
        query={myScenariosData}
        isEmpty={(data) => data.items.length === 0}
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
        {() => (
          <PaginatedGrid
            hasMore={hasMore}
            isLoadingMore={myScenariosData.isFetching}
            onLoadMore={handleLoadMore}
          >
            {allItems.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </PaginatedGrid>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
