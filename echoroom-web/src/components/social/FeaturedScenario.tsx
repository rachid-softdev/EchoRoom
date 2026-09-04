"use client";

import { Heart, Play, Star } from "lucide-react";
import Link from "next/link";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  Skeleton,
} from "@echoroom/ui";
import { api } from "@/lib/trpc";

export function FeaturedScenario() {
  const featuredQuery = api.social.getFeatured.useQuery();

  if (featuredQuery.isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5 mb-8">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-16 h-16 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const scenario = featuredQuery.data;
  if (!scenario) return null;

  const playCount = scenario.playCount ?? 0;
  const likeCount = scenario.likeCount ?? 0;

  return (
    <Card className="border-primary/20 bg-primary/5 mb-8 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Character avatar */}
          {scenario.character && (
            <Avatar className="w-16 h-16 shrink-0 ring-2 ring-primary/20">
              {scenario.character.avatarUrl ? (
                <AvatarImage src={scenario.character.avatarUrl} alt={scenario.character.name} />
              ) : null}
              <AvatarFallback className="text-lg bg-primary/10 text-primary">
                {scenario.character.name?.charAt(0) ?? "?"}
              </AvatarFallback>
            </Avatar>
          )}

          <div className="flex-1 min-w-0">
            {/* Badge */}
            <Badge
              variant="outline"
              className="mb-2 border-primary/30 text-primary text-[10px] gap-1"
            >
              <Star className="w-3 h-3" />
              Scénario du jour
            </Badge>

            {/* Title */}
            <h3 className="text-lg font-bold mb-1 truncate">{scenario.title}</h3>

            {/* Description */}
            {scenario.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {scenario.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {likeCount}
              </span>
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3" />
                {playCount}
              </span>
              {scenario.creator && <span>par {scenario.creator.username}</span>}
            </div>

            {/* CTA */}
            <Link href={`/create?scenario=${scenario.id}`}>
              <Button size="sm" className="gap-1.5">
                <Play className="w-4 h-4" />
                Démarrer
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
