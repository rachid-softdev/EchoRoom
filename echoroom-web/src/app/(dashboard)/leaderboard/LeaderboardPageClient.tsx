"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { LeaderboardTable } from "@/components/social/LeaderboardTable";
import { cn } from "@echoroom/ui";
import { api } from "@/lib/trpc";

type Period = "ALL" | "WEEK" | "MONTH";
type Tab = "SCENARIOS" | "CREATORS";

const PERIOD_LABELS: Record<Period, string> = {
  ALL: "Tout",
  WEEK: "Cette semaine",
  MONTH: "Ce mois",
};

export default function LeaderboardPageClient() {
  const [activeTab, setActiveTab] = useState<Tab>("SCENARIOS");
  const [period, setPeriod] = useState<Period>("ALL");

  const scenariosQuery = api.social.getLeaderboardScenarios.useQuery(
    {
      period,
      sort: "LIKES",
    },
    {
      enabled: activeTab === "SCENARIOS",
    },
  );
  const creatorsQuery = api.social.getLeaderboardCreators.useQuery(
    {
      period,
      sort: "LIKES",
    },
    {
      enabled: activeTab === "CREATORS",
    },
  );

  const scenarioEntries =
    scenariosQuery.data?.items.map((s, i) => ({
      rank: i + 1,
      id: s.id,
      name: s.title,
      image: s.character?.avatarUrl,
      value: s.likeCount,
      ...(s.creator?.username ? { extra: `par ${s.creator.username}` } : {}),
    })) ?? [];

  const creatorEntries =
    creatorsQuery.data?.items.map((u, i) => ({
      rank: i + 1,
      id: u.id,
      name: u.username,
      image: u.image,
      value: u.totalLikesReceived,
      extra: `${u._count.scenarios} scénario${u._count.scenarios > 1 ? "s" : ""}`,
    })) ?? [];

  return (
    <DashboardShell
      title="Classement"
      subtitle="Les meilleurs scénarios et créateurs de la communauté"
    >
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border w-fit mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("SCENARIOS")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "SCENARIOS"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Scénarios
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("CREATORS")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            activeTab === "CREATORS"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Créateurs
        </button>
      </div>

      {/* Period filter */}
      <div className="flex gap-2 mb-6">
        {(["ALL", "WEEK", "MONTH"] as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
              period === p
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "SCENARIOS" ? (
        <LeaderboardTable
          title="Scénarios les plus likés"
          entries={scenarioEntries}
          valueLabel="J'aime"
          isLoading={scenariosQuery.isLoading}
        />
      ) : (
        <LeaderboardTable
          title="Créateurs les plus likés"
          entries={creatorEntries}
          valueLabel="J'aime reçus"
          isLoading={creatorsQuery.isLoading}
        />
      )}
    </DashboardShell>
  );
}
