"use client"

import { Medal, AlertCircle } from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Skeleton,
} from "@/components/ui"
import { api } from "@/lib/trpc"
import { EmptyState } from "@/components/shared/EmptyState"

interface BadgeDisplayProps {
  userId: string
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function BadgeDisplay({ userId }: BadgeDisplayProps) {
  const badgesQuery = api.social.getUserBadges.useQuery({ userId })

  if (badgesQuery.isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`badge-skel-${i}`}
            className="rounded-xl border border-border p-4 space-y-2"
          >
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (badgesQuery.isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive py-4">
        <AlertCircle className="w-4 h-4" />
        <span>Erreur lors du chargement des badges</span>
      </div>
    )
  }

  const badges = badgesQuery.data ?? []

  if (badges.length === 0) {
    return (
      <EmptyState
        icon={Medal}
        title="Aucun badge pour le moment"
        description="Participez à la communauté pour débloquer des badges !"
      />
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {badges.map((ub) => (
        <Card key={ub.id} className="border-border/50">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm">
                {ub.badge.iconUrl ? (
                  <img
                    src={ub.badge.iconUrl}
                    alt=""
                    className="w-5 h-5"
                  />
                ) : (
                  <Medal className="w-4 h-4 text-primary" />
                )}
              </div>
              <CardTitle className="text-sm font-semibold">
                {ub.badge.name}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <CardDescription className="text-xs">
              {ub.badge.description}
            </CardDescription>
            <p className="text-[10px] text-muted-foreground mt-2">
              Obtenu le {formatDate(ub.awardedAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
