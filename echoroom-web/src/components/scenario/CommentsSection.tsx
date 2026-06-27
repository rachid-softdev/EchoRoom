"use client";

import { Send, Trash2 } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Avatar, AvatarFallback, AvatarImage, Button, Input, toast } from "@/components/ui";
import { useUser } from "@/hooks";
import { api } from "@/lib/trpc";

interface CommentsSectionProps {
  scenarioId: string;
}

export function CommentsSection({ scenarioId }: CommentsSectionProps) {
  const { isAuthenticated } = useUser();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";
  const [commentInput, setCommentInput] = useState("");
  const [confirmModerateId, setConfirmModerateId] = useState<string | null>(null);

  const commentsQuery = api.community.getComments.useQuery({
    scenarioId,
    limit: 20,
  });

  const commentMutation = api.community.comment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      setCommentInput("");
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

  const moderateCommentMutation = api.admin.moderateComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch();
      toast({
        title: "Commentaire modéré",
        variant: "default",
      });
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de la modération",
        variant: "destructive",
      });
    },
  });

  const comments = commentsQuery.data?.items ?? [];

  const handleModerate = (commentId: string) => {
    moderateCommentMutation.mutate({ commentId });
    setConfirmModerateId(null);
  };

  return (
    <section>
      <h2 className="text-lg font-semibold mb-4">Commentaires ({comments.length})</h2>

      {comments.length > 0 ? (
        <div className="space-y-3 mb-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 p-3 rounded-xl border border-border/50">
              <Avatar className="w-8 h-8 shrink-0">
                {comment.user?.image ? (
                  <AvatarImage src={comment.user.image} alt={comment.user.username} />
                ) : null}
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {comment.user?.username?.charAt(0).toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium">{comment.user?.username ?? "Anonyme"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {isAdmin && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto w-6 h-6 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmModerateId(comment.id)}
                        disabled={moderateCommentMutation.isPending}
                        aria-label="Modérer le commentaire"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>

                      <ConfirmDialog
                        open={confirmModerateId === comment.id}
                        onOpenChange={(open) => {
                          if (!open) setConfirmModerateId(null);
                        }}
                        title="Modérer le commentaire"
                        description="Cette action supprimera le commentaire. Voulez-vous continuer ?"
                        confirmLabel="Modérer"
                        variant="destructive"
                        onConfirm={() => handleModerate(comment.id)}
                      />
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mb-6">
          Aucun commentaire pour le moment. Soyez le premier !
        </p>
      )}

      {/* Comment input */}
      {isAuthenticated ? (
        <div className="flex items-center gap-2">
          <Input
            placeholder="Ajouter un commentaire..."
            value={commentInput}
            onChange={(e) => setCommentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const content = commentInput.trim();
                if (content) {
                  commentMutation.mutate({ scenarioId, content });
                }
              }
            }}
            className="text-sm"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              const content = commentInput.trim();
              if (content) {
                commentMutation.mutate({ scenarioId, content });
              }
            }}
            disabled={!commentInput.trim() || commentMutation.isPending}
            aria-label="Envoyer le commentaire"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <Link
          href={`/login?redirect=/scenario/${scenarioId}`}
          className="text-sm text-primary hover:underline"
        >
          Connectez-vous pour commenter
        </Link>
      )}
    </section>
  );
}
