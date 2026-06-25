"use client";

import Link from "next/link";

interface EnergyBarProps {
  credits: number;
  todayCount: number;
}

/**
 * Three playful energy tiles replacing the 4 stat cards.
 * - 🔥 Ton énergie: cyan-tinted, shows contextual message based on todayCount
 * - ⚡ Crédits: neutral tile, shows credit count in a phrase
 * - 🚀 Lancer un appel: neutral tile that links to /create with hover lift
 */
export function EnergyBar({ credits, todayCount }: EnergyBarProps) {
  let energyMessage: string;
  if (todayCount === 0) {
    energyMessage = "Prêt à lancer ?";
  } else if (todayCount > 5) {
    energyMessage = "En feu !";
  } else {
    energyMessage = "Bien joué !";
  }

  const creditMessage =
    credits < 3
      ? `Il te reste ${credits} crédit${credits !== 1 ? "s" : ""}`
      : `${credits} crédits disponibles`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {/* 🔥 Ton énergie — cyan-tinted */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">🔥 Ton énergie</p>
          <p className="text-foreground">{energyMessage}</p>
        </div>
      </div>

      {/* ⚡ Crédits — neutral */}
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">⚡ Crédits</p>
          <p className="text-foreground">{creditMessage}</p>
        </div>
      </div>

      {/* 🚀 Lancer un appel — neutral with hover lift */}
      <Link href="/create" className="block group">
        <div className="rounded-xl border border-border/40 bg-card p-5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/30 group-hover:shadow-sm">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">🚀 Lancer un appel</p>
            <p className="text-foreground">Crée un nouveau scénario</p>
          </div>
        </div>
      </Link>
    </div>
  );
}
