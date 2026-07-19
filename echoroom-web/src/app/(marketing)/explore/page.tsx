"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { SegmentedControl } from "@echoroom/ui";
import { Search, Clock, Flame, ArrowUp } from "lucide-react";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import { MarketingNav } from "@/components/layout/MarketingNav";
import { ExploreHero } from "@/components/explore/ExploreHero";
import { CategoryCloud } from "@/components/explore/CategoryCloud";
import { ChaosSearch } from "@/components/explore/ChaosSearch";
import { GridHeader } from "@/components/explore/GridHeader";

// Category name → API enum mapping
const CATEGORY_TO_ENUM: Record<string, string> = {
  Romantique: "ROMANTIC",
  Chaotique: "CHAOTIC",
  Corporate: "CORPORATE",
  NPC: "NPC",
  Horreur: "HORROR",
  Cringe: "CRINGE",
  Gamer: "GAMER",
  Weird: "WEIRD",
};

type SortValue = "CHRONOLOGICAL" | "TRENDING" | "TOP";

const sortOptions = [
  { value: "CHRONOLOGICAL" as const, label: "Récents", icon: <Clock className="w-3.5 h-3.5" /> },
  { value: "TRENDING" as const, label: "En folie", icon: <Flame className="w-3.5 h-3.5" /> },
  { value: "TOP" as const, label: "Meilleurs", icon: <ArrowUp className="w-3.5 h-3.5" /> },
];

function readInitialParams() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const sort = params.get("sort") as SortValue | null;
  const category = params.get("category");
  const search = params.get("search");
  return {
    sort: sort && ["CHRONOLOGICAL", "TRENDING", "TOP"].includes(sort) ? sort : "TRENDING" as SortValue,
    category: category ?? "Tous",
    search: search ?? "",
  };
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i] as T;
    shuffled[i] = shuffled[j] as T;
    shuffled[j] = temp;
  }
  return shuffled;
}

export default function ExplorePage() {
  const initial = readInitialParams();
  const [activeCategory, setActiveCategory] = useState(initial.category);
  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [debouncedQuery, setDebouncedQuery] = useState(initial.search);
  const [sort, setSort] = useState<SortValue>(initial.sort);
  const [chaosKey, setChaosKey] = useState(0);
  const feedQuery = api.scenarios.feed.useQuery({ limit: 50, sort });

  // Track whether user has ever typed — used to collapse hero with animation
  const [hasInteracted, setHasInteracted] = useState(false);
  const isSearching = searchQuery.length > 0;

  // Increments on category/search change to trigger grid re-animation
  const [transitionKey, setTransitionKey] = useState(0);

  // Sync search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL params for shareable/bookmarkable URLs
  useEffect(() => {
    const params = new URLSearchParams();
    if (sort !== "TRENDING") params.set("sort", sort);
    if (activeCategory !== "Tous") params.set("category", activeCategory);
    if (searchQuery) params.set("search", searchQuery);
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [sort, activeCategory, searchQuery]);

  // Detect first search interaction for hero collapse animation
  useEffect(() => {
    if (isSearching && !hasInteracted) {
      setHasInteracted(true);
    }
  }, [isSearching, hasInteracted]);

  // Bump transition key when filters change to re-trigger stagger animation
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional re-trigger on filter change
  useEffect(() => {
    setTransitionKey((k) => k + 1);
  }, [activeCategory, debouncedQuery]);

  const filteredItems = useMemo(() => {
    // chaosKey is intentionally kept as a dependency to force a recompute (re-shuffle) when toggled
    void chaosKey;
    return feedQuery.data?.items.filter((scenario) => {
      const matchesCategory =
        activeCategory === "Tous" ||
        scenario.character?.category === CATEGORY_TO_ENUM[activeCategory];
      const matchesSearch =
        debouncedQuery === "" ||
        scenario.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        scenario.description.toLowerCase().includes(debouncedQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }) ?? [];
  }, [feedQuery.data, activeCategory, debouncedQuery, chaosKey]);

  const shuffledItems = useMemo(() => shuffleArray(filteredItems), [filteredItems]);

  // Derive trending titles from the feed for the hero marquee
  const trendingScenarios = useMemo(() => {
    if (feedQuery.data?.items && feedQuery.data.items.length > 0) {
      // Take up to 12 titles, cycling through with some repetition for substance
      const titles = feedQuery.data.items.map((s) => s.title);
      // Ensure enough items for looping
      while (titles.length < 8) titles.push(...titles);
      return titles.slice(0, 12);
    }
    return [
      "Fake Recruiter",
      "Le Patron Absurde",
      "Karaoke Night",
      "Date Aveugle",
      "Réunion du Lundi",
      "PVP Drama",
      "Appel Secret",
      "Cringe Story",
      "Horreur au Bureau",
      "GG EZ",
      "Monologue Intérieur",
      "Crise Existentialiste",
    ];
  }, [feedQuery.data]);

  // First item from feed used as featured spotlight
  const featuredScenario = useMemo(() => {
    return feedQuery.data?.items?.[0] ?? undefined;
  }, [feedQuery.data]);

  const handleChaosToggle = useCallback(() => {
    setChaosKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNav />

      <section className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        {/* ═══ Zone 1: The Pulse (Hero) ═══ */}
        <div
          className={`overflow-hidden transition-all duration-500 ease-out ${
            isSearching ? "max-h-0 opacity-0 mb-0" : "max-h-[500px] opacity-100 mb-8"
          }`}
        >
          <ExploreHero
            trendingScenarios={trendingScenarios}
            {...(featuredScenario ? { featured: featuredScenario } : {})}
          />
        </div>

        {/* ═══ Zone 2: The Chaos Controls ═══ */}
        <div className="space-y-4 mb-8">
          <ChaosSearch value={searchQuery} onChange={setSearchQuery} />

          <CategoryCloud
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
          />

          <div className="flex justify-end">
            <SegmentedControl
              options={sortOptions}
              value={sort}
              onChange={setSort}
            />
          </div>
        </div>

        {/* ═══ Zone 3: The Grid ═══ */}
        <DataLoader
          query={feedQuery}
          skeletonCount={6}
          isEmpty={(data) =>
            data.items.length === 0 &&
            activeCategory === "Tous" &&
            searchQuery === ""
          }
        >
          {(data) => {
            // Determine which items to display
            const useChaos = chaosKey > 0 && searchQuery === "" && activeCategory === "Tous";
            const items = useChaos
              ? shuffledItems
              : activeCategory !== "Tous" || searchQuery !== ""
                ? filteredItems
                : data.items;

            if (items.length === 0) {
              return (
                <div className="text-center py-20">
                  <div className="relative inline-flex mb-6">
                    <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full" />
                    <Search className="w-12 h-12 text-muted-foreground relative" />
                  </div>
                  <p className="text-lg font-semibold mb-2">
                    {searchQuery ? "Aucun résultat" : "Rien ici pour l&apos;instant"}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                    {searchQuery
                      ? "Essaie d&apos;autres mots-clés ou explore les catégories ci-dessus."
                      : "La communauté n&apos;a pas encore exploré cette catégorie. À toi de créer le premier scénario !"}
                  </p>
                </div>
              );
            }

            return (
              <div key={transitionKey} className="animate-fade-in">
                <GridHeader
                  resultCount={items.length}
                  chaosActive={useChaos}
                  onChaosToggle={handleChaosToggle}
                  {...(activeCategory !== "Tous" ? { categoryLabel: activeCategory } : {})}
                  {...(searchQuery ? { searchQuery } : {})}
                />
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((scenario, idx) => (
                    <div
                      key={scenario.id}
                      className={`animate-fade-in ${
                        idx < 6
                          ? (`stagger-${idx + 1}` as string)
                          : ""
                      }`}
                      style={{ animationDuration: "0.3s" }}
                    >
                      <ScenarioCard scenario={scenario} />
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        </DataLoader>
      </section>
    </div>
  );
}
