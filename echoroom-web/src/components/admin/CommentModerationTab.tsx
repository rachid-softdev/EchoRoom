"use client";

import { useState } from "react";
import { Button, toast } from "@/components/ui";
import { DataLoader } from "@/components/shared/DataLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/trpc";
import { MessageCircle } from "lucide-react";

export function CommentModerationTab() {
  const [status, setStatus] = useState<"PENDING" | "REJECTED">("PENDING");
  const utils = api.useUtils();

  const query = api.admin.moderationQueueComments.useQuery({
    limit: 20,
    status,
  });

  const approveMutation = api.admin.approveComment.useMutation({
    onSuccess: () => {
      toast({ title: "Commentaire approuvé", variant: "success" });
      utils.admin.moderationQueueComments.refetch();
    },
    onError: (err) => {
      toast({ title: err.message ?? "Erreur lors de l'approbation", variant: "destructive" });
    },
  });

  const rejectMutation = api.admin.rejectComment.useMutation({
    onSuccess: () => {
      toast({ title: "Commentaire rejeté", variant: "success" });
      utils.admin.moderationQueueComments.refetch();
    },
    onError: (err) => {
      toast({ title: err.message ?? "Erreur lors du rejet", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={status === "PENDING" ? "default" : "outline"}
          onClick={() => setStatus("PENDING")}
        >
          En attente
        </Button>
        <Button
          size="sm"
          variant={status === "REJECTED" ? "default" : "outline"}
          onClick={() => setStatus("REJECTED")}
        >
          Rejetés
        </Button>
      </div>

      <DataLoader
        query={query}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            icon={MessageCircle}
            title={
              status === "PENDING"
                ? "Aucun commentaire en attente"
                : "Aucun commentaire rejeté"
            }
            description="Tous les commentaires ont été modérés."
          />
        }
      >
        {(data) => (
          <div className="space-y-4">
            {data.items.map((comment) => (
              <div
                key={comment.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1 min-w-0 mr-4">
                    <p className="text-sm font-medium">
                      {comment.user.username}
                    </p>
                    <a
                      href={`/scenario/${comment.scenario.id}`}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      Sur : {comment.scenario.title}
                    </a>
                    <p className="text-sm mt-2">{comment.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(comment.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {status === "PENDING" && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          approveMutation.mutate({
                            commentId: comment.id,
                          })
                        }
                        disabled={approveMutation.isPending}
                      >
                        Approuver
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          rejectMutation.mutate({ id: comment.id })
                        }
                        disabled={rejectMutation.isPending}
                      >
                        Rejeter
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DataLoader>
    </div>
  );
}
