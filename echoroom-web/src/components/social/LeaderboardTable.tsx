"use client";

import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, cn, Skeleton } from "@echoroom/ui";

interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  image?: string | null;
  value: number;
  extra?: string;
}

interface LeaderboardTableProps {
  title: string;
  entries: LeaderboardEntry[];
  valueLabel: string;
  isLoading: boolean;
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("fr-FR");
}

function getRankStyle(rank: number): string {
  switch (rank) {
    case 1:
      return "text-yellow-400";
    case 2:
      return "text-gray-300";
    case 3:
      return "text-amber-600";
    default:
      return "text-muted-foreground";
  }
}

function getRankBadge(rank: number): React.ReactNode {
  if (rank <= 3) {
    return <Trophy className={cn("w-4 h-4", getRankStyle(rank))} />;
  }
  return (
    <span className="text-xs text-muted-foreground w-4 h-4 flex items-center justify-center font-mono">
      {rank}
    </span>
  );
}

export function LeaderboardTable({ title, entries, valueLabel, isLoading }: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={`lb-skel-${i}`}
            className="flex items-center gap-3 p-3 rounded-xl border border-border"
          >
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-8 h-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Aucune entrée dans le classement</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="space-y-1">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-colors",
              entry.rank <= 3
                ? "border-primary/20 bg-primary/5"
                : "border-border/50 hover:border-border",
            )}
          >
            {/* Rank */}
            <div className="w-6 h-6 flex items-center justify-center">
              {getRankBadge(entry.rank)}
            </div>

            {/* Avatar */}
            <Avatar className="w-8 h-8">
              {entry.image ? <AvatarImage src={entry.image} alt={entry.name} /> : null}
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {entry.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{entry.name}</p>
              {entry.extra && (
                <p className="text-xs text-muted-foreground truncate">{entry.extra}</p>
              )}
            </div>

            {/* Value */}
            <div className="text-right">
              <p className="text-sm font-semibold">{formatNumber(entry.value)}</p>
              <p className="text-[10px] text-muted-foreground">{valueLabel}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
