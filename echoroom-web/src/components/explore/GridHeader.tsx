"use client";

import { Shuffle } from "lucide-react";
import { Button } from "@echoroom/ui";
import { cn } from "@echoroom/ui/lib";

interface GridHeaderProps {
  resultCount: number;
  chaosActive: boolean;
  onChaosToggle: () => void;
  categoryLabel?: string;
  searchQuery?: string;
}

/**
 * Header above the scenario card grid with result count framing and
 * the "Surprise-moi" chaos shuffle action.
 */
export function GridHeader({
  resultCount,
  chaosActive,
  onChaosToggle,
  categoryLabel,
  searchQuery,
}: GridHeaderProps) {
  const label = categoryLabel && categoryLabel !== "Tous" ? categoryLabel : null;

  return (
    <div className="flex items-center justify-between mb-4">
      {/* Result count — social framing */}
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {resultCount.toLocaleString("fr-FR")}
        </span>{" "}
        scénario{resultCount !== 1 ? "s" : ""} trouvé{resultCount !== 1 ? "s" : ""}
        {label && (
          <span>
{" "}dans <span className="font-medium text-foreground">{label}</span>
          </span>
        )}
        {searchQuery && (
          <span>
{" "}pour &ldquo;<span className="font-medium text-foreground">{searchQuery}</span>&rdquo;
          </span>
        )}
      </div>

      {/* Surprise-moi button */}
      <Button
        variant={chaosActive ? "default" : "outline"}
        size="sm"
        className={cn(
          "gap-2 shrink-0 transition-all duration-300",
          chaosActive && "shadow-lg shadow-primary/20",
        )}
        onClick={onChaosToggle}
      >
        <Shuffle
          className={cn(
            "w-3.5 h-3.5",
            chaosActive && "animate-pulse-soft",
          )}
        />
        <span className="hidden sm:inline">Surprise-moi</span>
        {chaosActive && (
          <span className="text-xs opacity-80 hidden sm:inline">
            (🎲 Mode chaos)
          </span>
        )}
      </Button>
    </div>
  );
}
