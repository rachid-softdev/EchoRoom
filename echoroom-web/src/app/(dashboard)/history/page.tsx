"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { Clock, Phone } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { CallHistoryRow } from "@/components/shared/CallHistoryRow";
import { EmptyState } from "@/components/shared/EmptyState";
import { PaginatedDataLoader } from "@/components/shared/PaginatedDataLoader";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/trpc";

export default function HistoryPage() {
  const paginated = usePaginatedQuery(
    (args) => api.calls.history.useQuery(args),
    { limit: 20 },
  );

  return (
    <DashboardShell
      title="Historique des appels"
      subtitle="Consultez vos appels passés et réécoutez vos meilleurs moments"
    >
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
        {(items) => (
          <div>
            <div className="space-y-2">
              {items.map((call: any) => (
                <CallHistoryRow key={call.id} call={call as any} />
              ))}
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
          </div>
        )}
      </PaginatedDataLoader>
    </DashboardShell>
  );
}
