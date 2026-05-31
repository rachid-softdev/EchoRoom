"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { Sparkles, Phone, Users, Globe, ArrowRight, Zap, Shield, Share2, Headphones, Menu, X } from "lucide-react";
import { api } from "@/lib/trpc";
import { DataLoader } from "@/components/shared/DataLoader";
import { ScenarioCard } from "@/components/shared/ScenarioCard";

const features = [
  {
    icon: Phone,
    title: "Appels IA immersifs",
    description: "Parlez à des personnages générés par IA avec des voix ultra-réalistes via ElevenLabs.",
  },
  {
    icon: Sparkles,
    title: "Scénarios sur mesure",
    description: "Créez vos propres scénarios ou piochez dans la bibliothèque communautaire.",
  },
  {
    icon: Share2,
    title: "Partage viral",
    description: "Enregistrez, replayez et partagez vos meilleurs moments sur TikTok, Discord et Twitter.",
  },
  {
    icon: Users,
    title: "Communauté sociale",
    description: "Likez, commentez et réagissez aux créations des autres membres.",
  },
  {
    icon: Shield,
    title: "Modération IA",
    description: "Notre IA filtre automatiquement les contenus inappropriés pour une expérience safe.",
  },
  {
    icon: Zap,
    title: "Gratuit pour commencer",
    description: "5 crédits offerts à l'inscription. Aucune carte bancaire requise.",
  },
];

export default function HomePage() {
  const featuredQuery = api.scenarios.feed.useQuery({ limit: 3 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <div className="flex flex-col min-h-screen">
      {/* ─── Nav ────────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Phone className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold tracking-tight">EchoRoom</span>
        </div>
        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Explorer
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Tarifs
          </Link>
          <Link href="/login">
            <Button variant="ghost" size="sm">Connexion</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">S&apos;inscrire</Button>
          </Link>
        </div>
        {/* Mobile burger */}
        <div className="md:hidden">
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </nav>
      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card px-4 py-4 flex flex-col gap-3">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
            Explorer
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2" onClick={() => setMobileMenuOpen(false)}>
            Tarifs
          </Link>
          <div className="flex gap-3 pt-2 border-t border-border">
            <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full">Connexion</Button>
            </Link>
            <Link href="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full">S&apos;inscrire</Button>
            </Link>
          </div>
        </div>
      )}

      {/* ─── Hero ───────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <Badge variant="secondary" className="mb-6">
          AI Social Chaos Platform
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-3xl leading-tight">
          Les appels IA que tout{" "}
          <span className="text-primary">TikTok</span> va partager
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          Créez des scénarios absurdes, parlez à des personnages IA délirants, et
          partagez vos meilleurs moments avec le monde entier.
        </p>
        <div className="flex items-center gap-4 mt-8">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              Commencer gratuitement <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/explore">
            <Button variant="outline" size="lg">
              Voir la bibliothèque
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          5 crédits offerts • Sans engagement • Annulation à tout moment
        </p>
      </section>

      {/* ─── Stats ──────────────────────────────────────────── */}
      <section className="border-y border-border">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-border max-w-2xl mx-auto">
          <div className="flex flex-col items-center py-8">
            <span className="text-3xl font-bold text-primary">50K+</span>
            <span className="text-sm text-muted-foreground mt-1">Appels générés</span>
          </div>
          <div className="flex flex-col items-center py-8">
            <span className="text-3xl font-bold text-primary">8</span>
            <span className="text-sm text-muted-foreground mt-1">Personnages uniques</span>
          </div>
          <div className="flex flex-col items-center py-8">
            <span className="text-3xl font-bold text-primary">100%</span>
            <span className="text-sm text-muted-foreground mt-1">IA générative</span>
          </div>
        </div>
      </section>

      {/* ─── Features ───────────────────────────────────────── */}
      <section className="px-6 py-20 max-w-6xl mx-auto w-full">
        <h2 className="text-3xl font-bold text-center mb-12">
          Tout ce dont vous avez besoin pour <span className="text-primary">créer le chaos</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-border/50">
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

        {/* ─── Featured Scenarios ─────────────────────────────── */}
        <section className="px-6 py-20 max-w-6xl mx-auto w-full border-t border-border">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-bold">
                Scénarios <span className="text-primary">populaires</span>
              </h2>
              <p className="text-muted-foreground mt-2">
                Découvrez ce que la communauté crée
              </p>
            </div>
            <Link href="/explore">
              <Button variant="ghost" className="gap-2">
                Voir tout <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <DataLoader
            query={featuredQuery}
            isEmpty={(data) => data.items.length === 0}
          >
            {(data) => (
              <div className="grid md:grid-cols-3 gap-6">
                {data.items.map((scenario) => (
                  <ScenarioCard key={scenario.id} scenario={scenario} />
                ))}
              </div>
            )}
          </DataLoader>
        </section>

      {/* ─── CTA ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 text-center border-t border-border">
        <div className="max-w-xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">
            Prêt à faire du <span className="text-primary">bruit</span> ?
          </h2>
          <p className="text-muted-foreground mb-8">
            Rejoignez des milliers de créateurs qui utilisent déjà EchoRoom pour
            générer des appels IA viraux.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2 text-base px-8">
              Créer mon compte <Globe className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ─── Demo Audio ───────────────────────────────────────── */}
      <section className="hidden md:block px-6 py-16 text-center border-t border-border bg-muted/30">
        <div className="max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-7 h-7 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">
            Écoutez un exemple d&apos;appel
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Fonctionnalité audio disponible prochainement. En attendant, explorez
            la bibliothèque de scénarios.
          </p>
        </div>
      </section>


    </div>
  );
}
