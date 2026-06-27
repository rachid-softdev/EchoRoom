"use client";

import { useState } from "react";
import { toast } from "@/components/ui";
import { api } from "@/lib/trpc";
import { EmojiPicker } from "./EmojiPicker";

interface ReactionBarProps {
  scenarioId: string;
}

export function ReactionBar({ scenarioId }: ReactionBarProps) {
  const [showPicker, setShowPicker] = useState(false);

  const reactionsQuery = api.social.getReactions.useQuery({ scenarioId });
  const toggleMutation = api.social.toggleLike.useMutation({
    onSuccess: () => {
      reactionsQuery.refetch();
    },
    onError: (err) => {
      toast({
        title: err.message || "Impossible de réagir",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (emoji: string) => {
    toggleMutation.mutate({ scenarioId, emoji });
  };

  const reactions = reactionsQuery.data?.reactions ?? [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Existing reaction buttons */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => handleToggle(r.emoji)}
          disabled={toggleMutation.isPending}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border border-border/50 hover:border-primary/30 transition-colors disabled:opacity-50"
        >
          <span className="text-base leading-none">{r.emoji}</span>
          <span className="text-xs text-muted-foreground font-medium">{r.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          disabled={toggleMutation.isPending}
          aria-label="Ajouter une réaction"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm border border-dashed border-border/50 hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <span className="text-base leading-none">+</span>
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-2 p-2 bg-card border border-border rounded-xl shadow-xl z-10">
            <EmojiPicker
              onSelect={(emoji) => {
                handleToggle(emoji);
                setShowPicker(false);
              }}
              disabled={toggleMutation.isPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}
