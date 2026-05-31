"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import { MessageCircle, Send, Users } from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { DataLoader } from "@/components/shared/DataLoader";
import { EmptyState } from "@/components/shared/EmptyState";
import { api } from "@/lib/trpc";
import { ReactionBar } from "@/components/social/ReactionBar";
import { CATEGORY_LABELS } from "@/lib/constants";
import { toast } from "@/components/ui";

export default function CommunityPageClient() {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const feedQuery = api.scenarios.feed.useQuery({ limit: 20 });
  const commentMutation = api.community.comment.useMutation({
    onSuccess: () => {
      feedQuery.refetch();
      toast({
        title: "Commentaire ajouté",
        variant: "default",
      });
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de l'ajout du commentaire",
        variant: "destructive",
      });
    },
  });

  function handleComment(scenarioId: string) {
    const content = commentInputs[scenarioId]?.trim();
    if (!content || commentMutation.isPending) return;
    commentMutation.mutate({ scenarioId, content });
    // Input is only cleared on success (in onSuccess callback)
  }

  return (
    <DashboardShell
      title="Communauté"
      subtitle="Les meilleurs moments partagés par la communauté"
    >
      <DataLoader
        query={feedQuery}
        isEmpty={(data) => data.items.length === 0}
        empty={
          <EmptyState
            icon={Users}
            title="Aucun post pour le moment"
            description="Soyez le premier à créer un scénario et à le partager !"
          />
        }
      >
        {(data) => (
          <div className="space-y-4">
            {data.items.map((scenario) => (
              <Link key={scenario.id} href={`/scenario/${scenario.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl">
                <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                        {scenario.creator?.username?.charAt(0).toUpperCase() ?? "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {scenario.creator?.username ?? "Anonyme"}
                        </p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {CATEGORY_LABELS[scenario.character?.slug?.toUpperCase() ?? ""] ??
                            "Scénario"}
                        </Badge>
                      </div>
                    </div>
                    <CardTitle className="text-base">{scenario.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <ReactionBar scenarioId={scenario.id} />
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        {scenario._count?.comments ?? 0}
                      </button>
                    </div>

                    {/* Comment input */}
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                      <Input
                        placeholder="Ajouter un commentaire..."
                        value={commentInputs[scenario.id] ?? ""}
                        onChange={(e) =>
                          setCommentInputs((prev) => ({
                            ...prev,
                            [scenario.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleComment(scenario.id);
                          }
                        }}
                        className="text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleComment(scenario.id)}
                        disabled={!commentInputs[scenario.id]?.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
