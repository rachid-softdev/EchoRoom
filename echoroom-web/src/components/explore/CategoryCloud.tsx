"use client";

import { cn } from "@echoroom/ui/lib";

interface CategoryCloudProps {
  activeCategory: string;
  onSelect: (category: string) => void;
}

interface CategoryTile {
  id: string;
  emoji: string;
  label: string;
  tagline: string;
}

const CATEGORIES: CategoryTile[] = [
  { id: "Chaotique", emoji: "😈", label: "Chaotique", tagline: "Le bazar organisé" },
  { id: "Romantique", emoji: "💕", label: "Romantique", tagline: "L'amour est aveugle… et IA" },
  { id: "Corporate", emoji: "💼", label: "Corporate", tagline: "Réunion de trop" },
  { id: "NPC", emoji: "🤖", label: "NPC", tagline: "Background character energy" },
  { id: "Horreur", emoji: "👻", label: "Horreur", tagline: "Frissons garantis" },
  { id: "Cringe", emoji: "😬", label: "Cringe", tagline: "Ferme les yeux, ça passe" },
  { id: "Gamer", emoji: "🎮", label: "Gamer", tagline: "Respwan et re" },
  { id: "Weird", emoji: "🌀", label: "Weird", tagline: "On ne pose pas de questions" },
];

/**
 * Playful 2-column grid of category tiles replacing pill-based filters.
 *
 * Each tile shows an emoji and label. Active tiles get a cyan border glow
 * and reveal their tagline. Inactive tiles sit at 40% opacity with a
 * grayscale feel and lift on hover.
 */
export function CategoryCloud({ activeCategory, onSelect }: CategoryCloudProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {/* "Tous" tile — special catch-all */}
      <button
        type="button"
        onClick={() => onSelect("Tous")}
        aria-pressed={activeCategory === "Tous"}
        className={cn(
          "relative group rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
          activeCategory === "Tous"
            ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
            : "border-border/50 bg-card/50 hover:border-border hover:bg-card",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-lg transition-transform duration-200",
              activeCategory === "Tous" ? "scale-110" : "group-hover:scale-110",
            )}
          >
            ✨
          </span>
          <span
            className={cn(
              "text-sm font-semibold transition-colors duration-200",
              activeCategory === "Tous"
                ? "text-foreground"
                : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            Tous
          </span>
        </div>
        {activeCategory === "Tous" && (
          <p className="text-[10px] text-primary/70 mt-0.5 leading-tight animate-fade-in">
            L&apos;intégralité du chaos
          </p>
        )}
      </button>

      {/* Category tiles */}
      {CATEGORIES.map((cat) => {
        const isActive = activeCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            aria-pressed={isActive}
            className={cn(
              "relative group rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
              isActive
                ? "border-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
                : "border-border/50 bg-card/50 hover:-translate-y-0.5 hover:border-border hover:bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-lg transition-all duration-200",
                  isActive ? "scale-110" : "opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-110",
                )}
              >
                {cat.emoji}
              </span>
              <span
                className={cn(
                  "text-sm font-semibold transition-colors duration-200",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {cat.label}
              </span>
            </div>
            {isActive && (
              <p className="text-[10px] text-primary/70 mt-0.5 leading-tight animate-fade-in">
                {cat.tagline}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
