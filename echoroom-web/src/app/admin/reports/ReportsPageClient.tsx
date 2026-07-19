"use client";

import { Check, Flag } from "lucide-react";
import { useState } from "react";
import { PaginatedDataLoader } from "@/components/shared/PaginatedDataLoader";
import { Badge, Button, Card, CardContent, toast } from "@echoroom/ui";
import { usePaginatedQuery } from "@/hooks/usePaginatedQuery";
import { api } from "@/lib/trpc";

const statusFilters = [
  { label: "Tous", value: undefined },
  { label: "En attente", value: "PENDING" },
  { label: "Traité", value: "REVIEWED" },
  { label: "Ignoré", value: "DISMISSED" },
];

const statusBadgeVariant: Record<string, "outline" | "secondary" | "default"> = {
  PENDING: "outline",
  REVIEWED: "default",
  DISMISSED: "secondary",
};

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  REVIEWED: "Traité",
  DISMISSED: "Ignoré",
};

const targetTypeLabels: Record<string, string> = {
  SCENARIO: "Scénario",
  COMMENT: "Commentaire",
  USER: "Utilisateur",
};

export default function ReportsPageClient() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const paginated = usePaginatedQuery(
    // biome-ignore lint/correctness/useHookAtTopLevel: usePaginatedQuery lazily invokes the tRPC hook inside its body — this is a valid pattern
    (args) => api.admin.getAbuseReports.useQuery({ ...args, status: statusFilter }),
    { limit: 20 },
  );

  const dismissMutation = api.admin.dismissAbuseReport.useMutation({
    onSuccess: () => {
      toast({ title: "Signalement ignoré", variant: "success" });
      paginated.refetch();
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur",
        variant: "destructive",
      });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Signalements</h1>
          <p className="text-muted-foreground mt-1">Gérez les signalements de contenu abusif</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-6">
        {statusFilters.map((filter) => (
          <Button
            key={filter.label}
            variant={statusFilter === filter.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <PaginatedDataLoader
        query={paginated}
        empty={
          <Card className="border-border/50">
            <CardContent className="py-16 text-center">
              <Flag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Aucun signalement</h3>
              <p className="text-muted-foreground">Aucun signalement à afficher pour ce filtre.</p>
            </CardContent>
          </Card>
        }
      >
        {() => (
          <>
            <div className="space-y-3">
              {paginated.items.map((report) => (
                <Card key={report.id} className="border-border/50">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            {targetTypeLabels[report.targetType] ?? report.targetType}
                          </Badge>
                          <Badge
                            variant={statusBadgeVariant[report.status] ?? "outline"}
                            className="text-xs"
                          >
                            {statusLabels[report.status] ?? report.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            par {report.reporter?.username ?? "inconnu"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {report.reason.length > 100
                            ? `${report.reason.slice(0, 100)}...`
                            : report.reason}
                        </p>
                        {report.reviewedBy && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Reviewé par {report.reviewedBy.username}
                          </p>
                        )}
                      </div>
                      {report.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 gap-1.5 text-muted-foreground hover:text-green-500"
                          onClick={() => dismissMutation.mutate({ reportId: report.id })}
                          disabled={dismissMutation.isPending}
                        >
                          <Check className="w-4 h-4" />
                          Ignorer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
          </>
        )}
      </PaginatedDataLoader>
    </div>
  );
}
