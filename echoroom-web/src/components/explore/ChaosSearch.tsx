"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@echoroom/ui";
import { Search, Sparkles, X } from "lucide-react";
import { cn } from "@echoroom/ui/lib";

interface ChaosSearchProps {
  value: string;
  onChange: (value: string) => void;
}

const PLACEHOLDERS = [
  "Cherche 'Fake Recruiter'…",
  "Trouve ton prochain chaos…",
  "NPC ou Romantique ?",
  "Explore les abysses…",
  "Ose le Weird…",
];

/**
 * Enhanced search input with cycling placeholder, icon swap on typing,
 * cyan glow on focus, and a clear button.
 */
export function ChaosSearch({ value, onChange }: ChaosSearchProps) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle placeholder every 4s
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="relative">
      {/* Icon — Sparkles when empty, Search when typing */}
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        {value ? (
          <Search className="w-4 h-4 text-muted-foreground transition-opacity" />
        ) : (
          <Sparkles className="w-4 h-4 text-primary/70 transition-opacity" />
        )}
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDERS[placeholderIndex]}
        className={cn(
          "pl-10 pr-10",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "focus-visible:shadow-lg focus-visible:shadow-primary/20",
        )}
      />

      {/* Clear button */}
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Effacer la recherche"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
