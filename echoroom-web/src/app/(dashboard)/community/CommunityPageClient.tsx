"use client";

import { useState } from "react";
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

const CATEGORY_LABELS: Record<string, string> = {
  ROMANTIC: "Romantique",
  CHAOTIC: "Chaotique",
  CORPORATE: "Corporate",
  NPC: "NPC",
  HORROR: "Horreur",
  CRINGE: "Cringe",
  GAMER: "Gamer",
  WEIRD: "Weird",
};

export default function CommunityPageClient() {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const feedQuery = api.scenarios.feed.useQuery({ limit: 20 });
  const commentMutation = api.community.comment.useMutation();

  function handleComment(scenarioId: string) {
    const content = commentInputs[scenarioId]?.trim();
    if (!content) return;
    commentMutation.mutate({ scenarioId, content });
    setCommentInputs((prev) => ({ ...prev, [scenarioId]: "" }));
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
              <Card key={scenario.id} className="border-border/50">
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
            ))}
          </div>
        )}
      </DataLoader>
    </DashboardShell>
  );
}
