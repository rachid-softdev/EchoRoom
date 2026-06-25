"use client";

import Link from "next/link";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

/**
 * Shows the top 6 trending community scenarios for the week sorted by plays.
 * Always rendered — community content is public even for new users.
 */
export function TrendingFeed() {
  const trendingQuery = api.social.getLeaderboardScenarios.useQuery({
    period: "WEEK",
    sort: "PLAYS",
  });

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">🔥 Ça chauffe en ce moment</h2>
      <DataLoader
        query={trendingQuery}
        skeletonCount={6}
        skeleton={
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`trend-skel-${i}`}
                className="rounded-xl border border-border p-4 space-y-3"
              >
                <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-6 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        }
        isEmpty={(data) => data.items.length === 0}
        empty={
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg font-semibold mb-2">Pas encore de tendances</p>
            <p className="text-sm">
              Reviens voir quand la communauté aura créé plus de scénarios !
            </p>
          </div>
        }
      >
        {(data) => (
          <div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.items.slice(0, 6).map((scenario) => (
                <ScenarioCard key={scenario.id} scenario={scenario} showCreator />
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link href="/community" className="text-sm text-primary hover:underline">
                Voir tout le feed →
              </Link>
            </div>
          </div>
        )}
      </DataLoader>
    </section>
  );
}
