"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

export function FeaturedScenariosSection() {
  const featuredQuery = api.social.getFeatured.useQuery();

  return (
    <section className="px-6 py-20 max-w-6xl mx-auto w-full border-t border-border">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h2 className="text-3xl font-bold">
            Scénario <span className="text-primary">à la une</span>
          </h2>
          <p className="text-muted-foreground mt-2">
            Découvrez le scénario du jour sélectionné par la communauté
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
        isEmpty={(data) => !data}
        empty={
          <div className="text-center py-16 text-muted-foreground">
            Aucun scénario à la une aujourd'hui
          </div>
        }
      >
        {(scenario) => (
          <div className="relative max-w-xl">
            <Badge className="absolute -top-2 -left-2 z-10 bg-primary text-primary-foreground text-xs">
              À la une
            </Badge>
            <ScenarioCard scenario={scenario} />
          </div>
        )}
      </DataLoader>
    </section>
  );
}
