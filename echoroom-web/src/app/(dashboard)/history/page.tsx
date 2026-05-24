"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Clock, Phone } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataLoader } from "@/components/shared/DataLoader";
import { CallHistoryRow } from "@/components/shared/CallHistoryRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/trpc";

interface CallItem {
  id: string
  status: string
  durationSeconds: number
  createdAt: string | Date
  scenario?: {
    title: string
    character?: { name: string }
  }
}

export default function HistoryPage() {
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allItems, setAllItems] = useState<CallItem[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const callsData = api.calls.history.useQuery({ limit: 20, cursor });
  const calls = callsData.data;

  useEffect(() => {
    if (calls) {
      setAllItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = calls.items.filter((i) => !existingIds.has(i.id));
        return cursor ? [...prev, ...newItems] : newItems;
      });
      setHasMore(!!calls.nextCursor);
    }
  }, [calls, cursor]);

  const handleLoadMore = useCallback(() => {
    if (calls?.nextCursor) {
      setCursor(calls.nextCursor);
    }
  }, [calls?.nextCursor]);

  return (
    <DashboardShell
      title="Historique des appels"
      subtitle="Consultez vos appels passés et réécoutez vos meilleurs moments"
    >
      <DataLoader
        query={callsData}
        isEmpty={(data) => data.items.length === 0}
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
        {() => (
          <div>
            <div className="space-y-2">
              {allItems.map((call) => (
                <CallHistoryRow key={call.id} call={call} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={callsData.isFetching}
                >
                  {callsData.isFetching ? "Chargement..." : "Voir plus"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
