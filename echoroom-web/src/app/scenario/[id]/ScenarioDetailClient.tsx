"use client"

import Link from "next/link"
import {
  Button,
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Skeleton,
  Input,
} from "@/components/ui"
import {
  Heart,
  MessageCircle,
  Play,
  Send,
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { api } from "@/lib/trpc"
import { useUser } from "@/hooks"
import { useSession } from "next-auth/react"
import { ReactionBar } from "@/components/social/ReactionBar"
import { ShareButtons } from "@/components/social/ShareButtons"
import { ReportButton } from "@/components/social/ReportButton"
import { ScenarioCard } from "@/components/shared/ScenarioCard"
import { useState } from "react"
import { toast } from "@/components/ui"

interface ScenarioDetailClientProps {
  scenarioId: string
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toLocaleString("fr-FR")
}

export function ScenarioDetailClient({
  scenarioId,
}: ScenarioDetailClientProps) {
  const { isAuthenticated } = useUser()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === "ADMIN"
  const [commentInput, setCommentInput] = useState("")

  const scenarioQuery = api.scenarios.getById.useQuery({ id: scenarioId })
  const commentsQuery = api.community.getComments.useQuery({
    scenarioId,
    limit: 20,
  })
  const feedQuery = api.scenarios.feed.useQuery({
    limit: 4,
    sort: "CHRONOLOGICAL",
  })
  const commentMutation = api.community.comment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch()
      setCommentInput("")
      toast({
        title: "Commentaire ajouté",
        variant: "default",
      })
    },
  })

  const moderateCommentMutation = api.admin.moderateComment.useMutation({
    onSuccess: () => {
      commentsQuery.refetch()
      toast({
        title: "Commentaire modéré",
        variant: "success",
      })
    },
    onError: (err) => {
      toast({
        title: err.message ?? "Erreur lors de la modération",
        variant: "destructive",
      })
    },
  })

  if (scenarioQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </div>
    )
  }

  if (scenarioQuery.isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-semibold mb-2">
            Une erreur est survenue
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            {scenarioQuery.error?.message ??
              "Impossible de charger ce scénario"}
          </p>
          <Button
            variant="outline"
            onClick={() => scenarioQuery.refetch()}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  const scenario = scenarioQuery.data
  if (!scenario) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-2">
            Scénario introuvable
          </p>
          <Link href="/community">
            <Button variant="outline" className="mt-4">
              Voir la communauté
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const comments = commentsQuery.data?.items ?? []
  const relatedScenarios =
    feedQuery.data?.items.filter((s) => s.id !== scenarioId).slice(0, 3) ?? []

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Back link */}
        <Link
          href="/community"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la communauté
        </Link>

        {/* Scenario header */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="w-12 h-12 ring-2 ring-border">
              {scenario.character?.avatarUrl ? (
                <AvatarImage
                  src={scenario.character.avatarUrl}
                  alt={scenario.character.name}
                />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary">
                {scenario.character?.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{scenario.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {scenario.character?.name ?? "Scénario"}
                </Badge>
                {scenario.creator && (
                  <span className="text-xs text-muted-foreground">
                    par {scenario.creator.username}
                  </span>
                )}
              </div>
            </div>
          </div>

          {scenario.description && (
            <p className="text-muted-foreground mt-4 max-w-2xl">
              {scenario.description}
            </p>
          )}
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Heart className="w-4 h-4 text-primary" />
            <span className="font-medium">{formatNumber(scenario.likeCount ?? 0)}</span>
            <span>j&apos;aime</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Play className="w-4 h-4" />
            <span className="font-medium">{formatNumber(scenario.playCount ?? 0)}</span>
            <span>lectures</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="w-4 h-4" />
            <span className="font-medium">
              {formatNumber(scenario._count?.comments ?? 0)}
            </span>
            <span>commentaires</span>
          </div>
        </div>

        {/* Reactions */}
        <div>
          <ReactionBar scenarioId={scenarioId} />
        </div>

        {/* Share buttons */}
        <div className="flex items-center gap-2">
          <ShareButtons
            scenarioId={scenarioId}
            title={scenario.title}
            description={scenario.description}
          />
          <ReportButton targetType="SCENARIO" targetId={scenarioId} />
        </div>

        {/* CTA */}
        {isAuthenticated ? (
          <Link href={`/create?scenario=${scenarioId}`}>
            <Button className="gap-2">
              <Play className="w-4 h-4" />
              Démarrer l&apos;appel
            </Button>
          </Link>
        ) : (
          <Link href="/auth/login">
            <Button variant="outline" className="gap-2">
              Connectez-vous pour lancer l&apos;appel
            </Button>
          </Link>
        )}

        {/* Clip creator (placeholder — would need user's calls) */}
        {isAuthenticated && (
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Sélectionnez un appel dans votre historique pour créer un clip
            </p>
          </div>
        )}

        {/* Comments section */}
        <section>
          <h2 className="text-lg font-semibold mb-4">
            Commentaires ({comments.length})
          </h2>

          {comments.length > 0 ? (
            <div className="space-y-3 mb-6">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="flex gap-3 p-3 rounded-xl border border-border/50"
                >
                  <Avatar className="w-8 h-8 shrink-0">
                    {comment.user?.image ? (
                      <AvatarImage
                        src={comment.user.image}
                        alt={comment.user.username}
                      />
                    ) : null}
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {comment.user?.username?.charAt(0).toUpperCase() ?? "?"}
                    </AvatarFallback>
                  </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {comment.user?.username ?? "Anonyme"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </span>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto w-6 h-6 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              moderateCommentMutation.mutate({
                                commentId: comment.id,
                              })
                            }
                            disabled={moderateCommentMutation.isPending}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {comment.content}
                      </p>
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
                  if (e.key === "Enter") {
                    const content = commentInput.trim()
                    if (content) {
                      commentMutation.mutate({
                        scenarioId,
                        content,
                      })
                    }
                  }
                }}
                className="text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  const content = commentInput.trim()
                  if (content) {
                    commentMutation.mutate({ scenarioId, content })
                  }
                }}
                disabled={!commentInput.trim() || commentMutation.isPending}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="text-sm text-primary hover:underline"
            >
              Connectez-vous pour commenter
            </Link>
          )}
        </section>

        {/* Related scenarios */}
        {relatedScenarios.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">
              Scénarios similaires
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {relatedScenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  href={`/scenario/${s.id}`}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
