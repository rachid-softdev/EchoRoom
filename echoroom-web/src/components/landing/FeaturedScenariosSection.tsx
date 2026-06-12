"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

export function FeaturedScenariosSection() {
  const featuredQuery = api.social.getFeatured.useQuery();

  return (
    <section className="relative overflow-hidden px-6 py-20 lg:py-28">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="w-3 h-3" />
              Scénario du jour
            </div>
            <h2 className="text-fluid-section font-black tracking-tight text-balance">
              Celui qui explose{" "}
              <span className="text-primary">en ce moment</span>
            </h2>
          </div>
          <Link href="/explore">
            <Button variant="ghost" className="gap-2 shrink-0">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <DataLoader
          query={featuredQuery}
          isEmpty={(data) => !data}
          empty={
            <div className="text-center py-16 text-muted-foreground">
              Aucun scénario à la une aujourd&rsquo;hui
            </div>
          }
        >
          {(scenario) => (
            <div className="relative max-w-xl animate-fade-in">
              <Badge className="absolute -top-2.5 -left-2.5 z-10 bg-primary text-primary-foreground text-xs shadow-lg shadow-primary/20">
                À la une
              </Badge>
              <ScenarioCard scenario={scenario} showShare />
            </div>
          )}
        </DataLoader>
      </div>
    </section>
  );
}
