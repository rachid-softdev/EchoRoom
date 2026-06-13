"use client";

import { useState, useMemo, useEffect } from "react";
import { Input, SegmentedControl, Button } from "@/components/ui";
import { Search, Shuffle, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";
import { MarketingNav } from "@/components/layout/MarketingNav";

// Primary categories shown upfront; the rest are collapsed behind "Plus"
const PRIMARY_CATEGORIES = ["Tous", "Chaotique", "Romantique", "Corporate", "NPC"];
const EXTRA_CATEGORIES = ["Horreur", "Cringe", "Gamer", "Weird"];
const ALL_CATEGORIES = [...PRIMARY_CATEGORIES, ...EXTRA_CATEGORIES];

const sortOptions = [
  { value: "CHRONOLOGICAL" as const, label: "Chronologique" },
  { value: "TRENDING" as const, label: "Tendance" },
  { value: "TOP" as const, label: "Top" },
];

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

function readInitialParams() {
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const sort = params.get("sort") as SortValue | null;
  const category = params.get("category");
  const search = params.get("search");
  return {
    sort: sort && ["CHRONOLOGICAL", "TRENDING", "TOP"].includes(sort) ? sort : "TRENDING" as SortValue,
    category: category && ALL_CATEGORIES.includes(category) ? category : "Tous",
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
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [chaosKey, setChaosKey] = useState(0);
  const feedQuery = api.scenarios.feed.useQuery({ limit: 50, sort });

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

  const visibleCategories = showAllCategories ? ALL_CATEGORIES : PRIMARY_CATEGORIES;
  const hiddenCount = ALL_CATEGORIES.length - PRIMARY_CATEGORIES.length;

  const filteredItems = useMemo(() =>
    feedQuery.data?.items.filter((scenario) => {
      const matchesCategory =
        activeCategory === "Tous" ||
        scenario.character?.category === CATEGORY_TO_ENUM[activeCategory];
      const matchesSearch =
        debouncedQuery === "" ||
        scenario.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        scenario.description.toLowerCase().includes(debouncedQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    }) ?? [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [feedQuery.data, activeCategory, debouncedQuery, chaosKey]
  );

  const shuffledItems = useMemo(() => shuffleArray(filteredItems), [filteredItems]);

  return (
    <div className="flex flex-col min-h-screen">
      <MarketingNav />

      <section className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-fluid-section font-bold mb-2">Explorer les scénarios</h1>
            <p className="text-muted-foreground">
              Découvrez les créations de la communauté EchoRoom
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 shrink-0"
            onClick={() => setChaosKey((k) => k + 1)}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Surprise-moi</span>
          </Button>
        </div>

        {/* Search + Sort — side by side */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un scénario..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <SegmentedControl
            options={sortOptions}
            value={sort}
            onChange={setSort}
          />
        </div>

        {/* Categories — collapsed by default */}
        <div className="flex flex-wrap items-center gap-2 mb-8">
          {visibleCategories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setActiveCategory(category)}
              aria-pressed={activeCategory === category}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === category
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {category}
            </button>
          ))}
          {!showAllCategories && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllCategories(true)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-colors flex items-center gap-1"
            >
              +{hiddenCount} autres <ChevronDown className="w-3 h-3" />
            </button>
          )}
          {showAllCategories && (
            <button
              type="button"
              onClick={() => setShowAllCategories(false)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary transition-colors flex items-center gap-1"
            >
              Moins <ChevronUp className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Grid */}
        <DataLoader
          query={feedQuery}
          isEmpty={(data) =>
            data.items.length === 0 &&
            activeCategory === "Tous" &&
            searchQuery === ""
          }
        >
          {(data) => {
            // When chaos key changes, show shuffled results
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
              <div>
                {useChaos && (
                  <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
                    <Shuffle className="w-3 h-3 text-primary" />
                    Mode chaos activé — les résultats sont mélangés aléatoirement
                  </p>
                )}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((scenario) => (
                    <ScenarioCard key={scenario.id} scenario={scenario} />
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
