"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

export function FeaturedScenariosSection() {
  const featuredQuery = api.scenarios.feed.useQuery({ limit: 3 });

  return (
    <section className="px-6 py-20 max-w-6xl mx-auto w-full border-t border-border">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold">
            Scénarios <span className="text-primary">populaires</span>
          </h2>
          <p className="text-muted-foreground mt-2">
            Découvrez ce que la communauté crée
          </p>
        </div>
        <Link href="/explore">
          <Button variant="ghost" className="gap-2">
            Voir tout <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
      <DataLoader
        query={featuredQuery}
        isEmpty={(data) => data.items.length === 0}
      >
        {(data) => (
          <div className="grid md:grid-cols-3 gap-6">
            {data.items.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        )}
      </DataLoader>
    </section>
  );
}
