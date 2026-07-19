"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard, type ScenarioCardData } from "@/components/shared/ScenarioCard";
import { Badge, Button } from "@echoroom/ui";
import { api } from "@/lib/trpc";

/**
 * Curated fallback shown when the backend is unreachable. Keeps the marketing
 * section visually complete instead of surfacing a raw error screen. These are
 * brand scenarios, so the content stays on-message even without live data.
 */
const FALLBACK_SCENARIOS: ScenarioCardData[] = [
  {
    id: "fallback-fake-recruiter",
    title: "Fake Recruiter Simulator",
    description:
      "Un recruteur IA totalement absurde qui transforme chaque entretien en chaos social.",
    character: { name: "Recruteur Aléatoire", category: "CORPORATE" },
    playCount: 128000,
    likeCount: 12400,
    visibility: "PUBLIC",
  },
  {
    id: "fallback-npc-support",
    title: "NPC Customer Support",
    description:
      "Le support client le plus inutile de l'univers. Plus tu expliques, pire ça devient.",
    character: { name: "Support Client", category: "NPC" },
    playCount: 96000,
    likeCount: 8700,
    visibility: "PUBLIC",
  },
  {
    id: "fallback-ex-girlfriend",
    title: "AI Ex Girlfriend Chaos",
    description: "Une conversation émotionnellement catastrophique générée en temps réel.",
    character: { name: "Ex virtuelle", category: "ROMANTIC" },
    playCount: 154000,
    likeCount: 19800,
    visibility: "PUBLIC",
  },
];

export function FeaturedScenariosSection() {
  const featuredQuery = api.social.getFeatured.useQuery();
  const isFallback = featuredQuery.isError;

  return (
    <section className="relative overflow-hidden px-6 py-20 lg:py-28">
      {/* Ambient glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-12">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="w-3 h-3" />
              {isFallback ? "Suggestions" : "Scénario du jour"}
            </div>
            <h2 className="text-fluid-section font-black tracking-tight text-balance">
              {isFallback ? (
                <>
                  Les scénarios les plus <span className="text-primary">populaires</span>
                </>
              ) : (
                <>
                  Celui qui explose <span className="text-primary">en ce moment</span>
                </>
              )}
            </h2>
          </div>
          <Link href="/explore">
            <Button variant="ghost" className="gap-2 shrink-0">
              Voir tout <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {isFallback ? (
          <div className="grid md:grid-cols-3 gap-4">
            {FALLBACK_SCENARIOS.map((scenario) => (
              <ScenarioCard key={scenario.id} scenario={scenario} showShare />
            ))}
          </div>
        ) : (
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
        )}
      </div>
    </section>
  );
}
