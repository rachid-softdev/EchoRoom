"use client";

import Link from "next/link";
import { Phone, Play } from "lucide-react";
import { Badge, Button, cn } from "@echoroom/ui";
import { api } from "@/lib/trpc";
import { LeaderboardTable } from "@/components/social/LeaderboardTable";
import { BadgePreview } from "./BadgePreview";
import { STATUS_LABELS, STATUS_VARIANTS, formatDate } from "@/lib/constants";

interface CallItem {
  id: string;
  status: string;
  durationSeconds: number;
  createdAt: string | Date;
  scenario?: { title: string; character?: { name: string } } | null;
}

interface SideWidgetsProps {
  userId: string | undefined;
  recentCalls: CallItem[];
  className?: string;
}

/**
 * Desktop sidebar with 3 stacked sections: top creators, recent calls, badges.
 * Renders inline on mobile via the grid layout.
 */
export function SideWidgets({ userId, recentCalls, className }: SideWidgetsProps) {
  const creatorsQuery = api.social.getLeaderboardCreators.useQuery({
    period: "WEEK",
    sort: "LIKES",
  });

  return (
    <aside className={cn("space-y-6", className)}>
      {/* Top créateurs */}
      <LeaderboardTable
        title="Top créateurs"
        entries={(creatorsQuery.data?.items ?? []).slice(0, 5).map((c, i) => ({
          rank: i + 1,
          id: c.id,
          name: c.username,
          image: c.image,
          value: c.totalLikesReceived,
          extra: `${c._count.scenarios} scénario${c._count.scenarios !== 1 ? "s" : ""}`,
        }))}
        valueLabel="likes"
        isLoading={creatorsQuery.isLoading}
      />

      {/* Tes derniers appels */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Tes derniers appels</h3>
        {recentCalls.length > 0 ? (
          <div className="space-y-1">
            {recentCalls.slice(0, 3).map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between py-3 px-3 rounded-xl border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {call.scenario?.title ?? "Appel"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant={(STATUS_VARIANTS[call.status] ?? "outline") as "outline" | "secondary" | "destructive" | "default"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {STATUS_LABELS[call.status] ?? call.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(call.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {call.status === "COMPLETED" && (
                  <Link href={`/call/${call.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1.5 shrink-0">
                      <Play className="w-3.5 h-3.5" />
                      Replay
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Pas encore d&apos;appels
          </div>
        )}
      </div>

      {/* Badges */}
      {userId !== undefined && <BadgePreview userId={userId} />}
    </aside>
  );
}
