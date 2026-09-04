import { ArrowUpRight, BarChart3, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@echoroom/ui";

export const metadata: Metadata = {
  title: "Admin — Analytiques — EchoRoom AI",
  description: "Tableau de bord analytique de la plateforme EchoRoom AI.",
  robots: { index: false, follow: false },
};

export default function AnalyticsPage() {
  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Analytiques</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
          Statistiques en cours
        </span>
      </div>

      {/* Stats placeholder grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Utilisateurs total", icon: "👥" },
          { label: "Appels total", icon: "📞" },
          { label: "Scénarios créés", icon: "🎭" },
          { label: "Revenus", icon: "📊" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-6 text-center">
              <span className="text-2xl mb-1 block">{stat.icon}</span>
              <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
              <p className="text-xs text-muted-foreground/60">
                Données disponibles après le déploiement
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Roadmap / status card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-2">
              <CardTitle>Tableau de bord analytique</CardTitle>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Les statistiques détaillées seront disponibles dans une prochaine mise à jour. Elles
                incluront :
              </p>
              <ul className="text-sm text-muted-foreground space-y-1.5">
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Évolution des inscriptions et de l&apos;engagement
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Appels générés et minutes cumulées
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Crédits consommés et revenus
                </li>
                <li className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  Top scénarios, personnages et créateurs
                </li>
              </ul>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Link to other admin tools */}
      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Link
          href="/admin/users"
          className="rounded-xl border border-border/50 bg-card p-4 hover:border-border transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Gestion des utilisateurs</span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
        <Link
          href="/admin/moderation"
          className="rounded-xl border border-border/50 bg-card p-4 hover:border-border transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Modération</span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-xl border border-border/50 bg-card p-4 hover:border-border transition-colors group"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Signalements</span>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
        </Link>
      </div>
    </>
  );
}
