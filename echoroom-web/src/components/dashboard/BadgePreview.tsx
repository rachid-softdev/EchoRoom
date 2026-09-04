"use client";

import { api } from "@/lib/trpc";
import { Badge, Skeleton } from "@echoroom/ui";
import { Medal } from "lucide-react";

interface BadgePreviewProps {
  userId: string;
}

/**
 * Compact badge row for the sidebar.
 * Fetches the first 3 user badges and renders them as small pills.
 */
export function BadgePreview({ userId }: BadgePreviewProps) {
  const badgesQuery = api.social.getUserBadges.useQuery({ userId });

  if (badgesQuery.isLoading) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Badges</h3>
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={`bp-skel-${i}`} className="h-6 w-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const badges = badgesQuery.data ?? [];

  if (badges.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Badges</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Medal className="w-4 h-4" />
          <span>Pas encore de badges</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-semibold">Badges</h3>
      <div className="flex flex-wrap gap-2">
        {badges.slice(0, 3).map((ub) => (
          <Badge key={ub.id} variant="secondary" className="text-xs">
            {ub.badge.name}
          </Badge>
        ))}
        {badges.length > 3 && (
          <span className="text-xs text-muted-foreground self-center">
            +{badges.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}
