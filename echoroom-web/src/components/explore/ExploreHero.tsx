"use client";

import { useState } from "react";
import { LiveCounter } from "@/components/landing/LiveCounter";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import type { ScenarioCardData } from "@/components/shared/ScenarioCard";
import { Sparkles, MessageCircle, Heart } from "lucide-react";

interface ExploreHeroProps {
  /** Titles for the trending marquee ticker */
  trendingScenarios: string[];
  /** Optional featured scenario spotlight card */
  featured?: ScenarioCardData;
}

const reactionEmojis = ["😈", "💕", "🤖", "👻", "😬", "🎮", "🌀", "🔥"];

/**
 * Compact hero strip for the explore page.
 *
 * Left (2/3): trending marquee + optional featured spotlight
 * Right (1/3): social proof (live counter, emoji stream, daily created count)
 */
export function ExploreHero({ trendingScenarios, featured }: ExploreHeroProps) {
  const [dailyCreated] = useState(() =>
    Math.floor(120 + Math.random() * 180)
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
      {/* ── Left: 2/3 ── */}
      <div className="lg:col-span-2 space-y-3">
        {/* Marquee ticker */}
        <div className="relative overflow-hidden rounded-xl bg-card border border-border h-10">
          <div className="flex whitespace-nowrap h-full items-center animate-marquee">
            {/* First copy */}
            <div className="flex shrink-0 items-center gap-0">
              {trendingScenarios.map((title, i) => (
                <span
                  key={`a-${i}`}
                  className="inline-flex items-center gap-2 px-4 text-sm font-medium text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {title}
                </span>
              ))}
            </div>
            {/* Duplicate copy for seamless loop */}
            <div className="flex shrink-0 items-center gap-0">
              {trendingScenarios.map((title, i) => (
                <span
                  key={`b-${i}`}
                  className="inline-flex items-center gap-2 px-4 text-sm font-medium text-muted-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {title}
                </span>
              ))}
            </div>
          </div>
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none" />
        </div>

        {/* Featured spotlight card */}
        {featured && (
          <div className="relative rounded-xl border border-primary/20 bg-card overflow-hidden">
            {/* Subtle top accent line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/40" />
            <div className="p-3">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold text-primary">
                <Sparkles className="w-3 h-3" />
                À la une
              </div>
              <ScenarioCard scenario={featured} showShare />
            </div>
          </div>
        )}
      </div>

      {/* ── Right: 1/3 — Social proof ── */}
      <div className="flex flex-row lg:flex-col gap-3">
        {/* Live listener count */}
        <div className="flex-1 lg:flex-none rounded-xl bg-card border border-border p-3 flex flex-col justify-center">
          <div className="text-2xl font-black text-primary tabular-nums leading-none">
            <LiveCounter />
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            en écoute
          </div>
        </div>

        {/* Mini reaction stream */}
        <div className="flex-1 lg:flex-none rounded-xl bg-card border border-border p-3 flex flex-col justify-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            {reactionEmojis.map((emoji, i) => (
              <span
                key={i}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted text-sm animate-fade-in"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: "0.3s" }}
                title={emoji}
              >
                {emoji}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
            <Heart className="w-3 h-3" />
            <span>La communauté réagit</span>
          </div>
        </div>

        {/* Daily created count */}
        <div className="flex-1 lg:flex-none rounded-xl bg-card border border-border p-3 flex flex-col justify-center">
          <div className="text-2xl font-black tabular-nums leading-none">
            {dailyCreated.toLocaleString("fr-FR")}
          </div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" />
            scénarios créés aujourd&rsquo;hui
          </div>
        </div>
      </div>
    </div>
  );
}
