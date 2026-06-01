"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { DataLoader } from "@/components/shared/DataLoader";
import { api } from "@/lib/trpc";
import { toast } from "@/components/ui";
import { Check, X, AlertTriangle } from "lucide-react";
import { CommentModerationTab } from "@/components/admin/CommentModerationTab";

type ModerationTab = "scenarios" | "comments";

export default function ModerationPageClient() {
  const [activeTab, setActiveTab] = useState<ModerationTab>("scenarios");
  const queueQuery = api.admin.moderationQueue.useQuery({ limit: 50 });
  const approveMutation = api.admin.approveScenario.useMutation({
    onSuccess: () => {
      toast({ title: "Scénario approuvé", variant: "success" });
      queueQuery.refetch();
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de l'approbation",
        variant: "destructive",
      });
    },
  });
  const rejectMutation = api.admin.rejectScenario.useMutation({
    onSuccess: () => {
      toast({ title: "Scénario rejeté", variant: "success" });
      queueQuery.refetch();
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors du rejet",
        variant: "destructive",
      });
    },
  });

  const queue = queueQuery.data;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">File de modération</h1>
          <p className="text-muted-foreground mt-1">
            {activeTab === "scenarios"
              ? `Scénarios en attente de validation : ${queue?.items.length ?? "..."}`
              : "Commentaires en attente de modération"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          size="sm"
          variant={activeTab === "scenarios" ? "default" : "outline"}
          onClick={() => setActiveTab("scenarios")}
        >
          Scénarios
        </Button>
        <Button
          size="sm"
          variant={activeTab === "comments" ? "default" : "outline"}
          onClick={() => setActiveTab("comments")}
        >
          Commentaires
        </Button>
      </div>

      {activeTab === "scenarios" ? (
        <DataLoader
          query={queueQuery}
          isEmpty={(data) => data.items.length === 0}
          empty={
            <Card className="border-border/50">
              <CardContent className="py-16 text-center">
                <Check className="w-16 h-16 text-primary mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Tout est modéré</h3>
                <p className="text-muted-foreground">
                  Aucun scénario en attente de validation.
                </p>
              </CardContent>
            </Card>
          }
        >
          {(data) => (
            <div className="space-y-3">
              {data.items.map((item) => (
                <Card key={item.id} className="border-border/50">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        par {item.creator?.username ?? "inconnu"}
                        {item.character ? ` — ${item.character.name}` : ""}
                        {" — "}
                        {new Date(item.createdAt).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        En attente
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-500 hover:text-green-400"
                        onClick={() =>
                          approveMutation.mutate({ scenarioId: item.id })
                        }
                        disabled={approveMutation.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          rejectMutation.mutate({ scenarioId: item.id })
                        }
                        disabled={rejectMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DataLoader>
      ) : (
        <CommentModerationTab />
      )}
    </div>
  );
}
