"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { Button, Input, SegmentedControl } from "@/components/ui";
import { Search, ArrowLeft } from "lucide-react";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

const categories = [
  "Tous",
  "Romantique",
  "Chaotique",
  "Corporate",
  "NPC",
  "Horreur",
  "Cringe",
  "Gamer",
  "Weird",
];

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
    sort: sort && ["CHRONOLOGICAL", "TRENDING", "TOP"].includes(sort) ? sort : "CHRONOLOGICAL" as SortValue,
    category: category && categories.includes(category) ? category : "Tous",
    search: search ?? "",
  };
}

export default function ExplorePage() {
  const initial = readInitialParams();
  const [activeCategory, setActiveCategory] = useState(initial.category);
  const [searchQuery, setSearchQuery] = useState(initial.search);
  const [debouncedQuery, setDebouncedQuery] = useState(initial.search);
  const [sort, setSort] = useState<SortValue>(initial.sort);
  const feedQuery = api.scenarios.feed.useQuery({ limit: 50, sort });

  // Sync search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL params for shareable/bookmarkable URLs
  useEffect(() => {
    const params = new URLSearchParams();
    if (sort !== "CHRONOLOGICAL") params.set("sort", sort);
    if (activeCategory !== "Tous") params.set("category", activeCategory);
    if (searchQuery) params.set("search", searchQuery);
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [sort, activeCategory, searchQuery]);

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
    [feedQuery.data, activeCategory, debouncedQuery]
  );

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Accueil
        </Link>
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Connexion
          </Button>
        </Link>
      </nav>

      <section className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-fluid-section font-bold mb-2">Explorer les scénarios</h1>
          <p className="text-muted-foreground">
            Découvrez les créations de la communauté EchoRoom
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un scénario..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Sort */}
        <div className="mb-6">
          <SegmentedControl
            options={sortOptions}
            value={sort}
            onChange={setSort}
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
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
            const items =
              activeCategory !== "Tous" || searchQuery !== ""
                ? filteredItems
                : data.items;

            if (items.length === 0) {
              return (
                <div className="text-center py-16">
                  <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-semibold mb-2">
                    Aucun résultat
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Essayez de modifier vos filtres ou votre recherche
                  </p>
                </div>
              );
            }

            return (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
              </div>
            );
          }}
        </DataLoader>
      </section>
    </div>
  );
}
