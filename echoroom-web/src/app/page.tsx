import { Headphones, MessageCircle, Share2, Shield, Sparkles, Users, Zap } from "lucide-react";
import Link from "next/link";
import { CallAudioVisualizer } from "@/components/landing/CallAudioVisualizer";
import { FeaturedScenariosSection } from "@/components/landing/FeaturedScenariosSection";
import { LiveCounter } from "@/components/landing/LiveCounter";
import { Button } from "@/components/ui";

/* ─── Static community data ───────────────────────────── */
const TRENDING_SCENARIOS = [
  "Fake Recruiter Simulator",
  "NPC Customer Support",
  "AI Ex Girlfriend Chaos",
] as const;

const FEATURES_HERO = [
  {
    icon: Headphones,
    title: "Appels IA immersifs",
    description:
      "Parle à des personnages générés par IA avec des voix ElevenLabs ultra-réalistes. Chaque appel est unique, chaque scénario est une surprise.",
    visual: "call",
  },
  {
    icon: MessageCircle,
    title: "Réactions en direct",
    description:
      "Jusqu'à des milliers d'auditeurs peuvent écouter ton appel en direct, réagir avec des emojis et voter pour la suite de la conversation.",
    visual: "reactions",
  },
] as const;

const FEATURES_SUPPORTING = [
  {
    icon: Sparkles,
    title: "Scénarios sur mesure",
    description:
      "Crée tes propres scénarios absurdes ou pioche dans la bibliothèque communautaire.",
  },
  {
    icon: Share2,
    title: "Clips viraux",
    description:
      "Extrais le meilleur moment en un clic et partage-le sur TikTok, Discord ou Twitter.",
  },
  {
    icon: Shield,
    title: "Modération safe",
    description: "Notre IA filtre automatiquement les contenus inappropriés. Fun oui, toxique non.",
  },
  {
    icon: Zap,
    title: "Gratuit pour commencer",
    description: "5 crédits offerts à l'inscription, sans carte bancaire.",
  },
] as const;

/* ─── Live Call Preview ────────────────────────────────── */
function LiveCallPreview() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:mx-0">
      {/* Glow backdrop */}
      <div className="absolute -inset-4 bg-primary/10 blur-3xl rounded-full" />

      {/* Call card */}
      <div className="relative rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse-soft" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Recruteur Aléatoire</p>
              <p className="text-xs text-muted-foreground">Scenario #0281</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse-soft" />
            <span className="text-[11px] font-semibold text-destructive tracking-wider uppercase">
              Live
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="space-y-3 px-5 py-5">
          {/* AI message */}
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3 max-w-[90%]">
            <p className="text-[11px] font-semibold text-primary mb-1.5 tracking-wide uppercase">
              AI Character
            </p>
            <p className="text-sm leading-relaxed">
              &ldquo;Bonjour. Votre CV est excellent mais… pourquoi avez-vous 47 expériences comme
              magicien ?&rdquo;
            </p>
          </div>

          {/* User message */}
          <div className="rounded-xl bg-secondary border border-border px-4 py-3 max-w-[85%] ml-auto">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5 tracking-wide uppercase">
              User
            </p>
            <p className="text-sm leading-relaxed">
              &ldquo;C&rsquo;était principalement des incidents Discord.&rdquo;
            </p>
          </div>

          {/* Audio visualizer (subtle) */}
          <CallAudioVisualizer />
        </div>

        {/* Listener bar */}
        <div className="flex items-center gap-3 border-t border-border bg-muted/30 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <LiveCounter className="tabular-nums" />
            <span>auditeurs</span>
          </div>
          <div className="flex -space-x-1.5">
            {["bg-primary", "bg-destructive/70", "bg-cyan-400", "bg-white/30"].map((color, i) => (
              <div key={i} className={`h-5 w-5 rounded-full border-2 border-card ${color}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Community Proof Strip ────────────────────────────── */
function CommunityProofStrip() {
  return (
    <section className="border-y border-border">
      <div className="max-w-6xl mx-auto px-6 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          {/* Live counter */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-soft" />
              <span className="text-primary font-semibold tabular-nums">
                <LiveCounter />
              </span>
              <span className="text-muted-foreground">en écoute</span>
            </div>
          </div>

          {/* Trending scenarios */}
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="hidden sm:inline">🔥 En tendance :</span>
            <span className="sm:hidden">🔥</span>
            <div className="flex items-center gap-3 flex-wrap">
              {TRENDING_SCENARIOS.map((name) => (
                <span
                  key={name}
                  className="text-foreground/80 font-medium text-xs truncate max-w-[140px] sm:max-w-none"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Reactions */}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span>💬</span>
            <span className="tabular-nums font-semibold text-foreground/80">12.4k</span>
            <span className="hidden sm:inline">réactions aujourd&rsquo;hui</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Feature Card (hero variant) ──────────────────────── */
function HeroFeatureCard({
  icon: Icon,
  title,
  description,
  visual,
  index,
}: {
  icon: typeof Headphones;
  title: string;
  description: string;
  visual: string;
  index: number;
}) {
  return (
    <div
      className={`flex flex-col lg:flex-row gap-8 items-center ${
        index % 2 === 1 ? "lg:flex-row-reverse" : ""
      } animate-fade-in [animation-delay:${index === 0 ? "100ms" : "250ms"}]
      transition-all duration-300`}
    >
      <div className="flex-1 space-y-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-2xl font-bold tracking-tight">{title}</h3>
        <p className="text-muted-foreground leading-relaxed max-w-md text-pretty">{description}</p>
      </div>
      <div className="flex-1 w-full">
        {visual === "call" ? (
          <LiveCallPreview />
        ) : (
          <div className="relative rounded-2xl border border-border bg-card overflow-hidden">
            {/* Reaction stream preview */}
            <div className="px-5 py-4 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                Reaction Feed
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {[
                { emoji: "😂", user: "tiktok_user_42", count: "2.3k" },
                { emoji: "💀", user: "discord_npc", count: "1.8k" },
                { emoji: "🔥", user: "chaos_creator", count: "956" },
              ].map((reaction) => (
                <div
                  key={reaction.user}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 hover:bg-muted/60 transition-colors duration-150"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{reaction.emoji}</span>
                    <span className="text-sm text-muted-foreground">@{reaction.user}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-foreground/80">
                    {reaction.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Supporting Feature Card ──────────────────────────── */
function SupportingFeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  index: number;
}) {
  return (
    <div
      className="rounded-xl border border-border/40 bg-card p-6 animate-fade-in transition-all duration-200 hover:border-border hover:-translate-y-0.5"
      style={{ animationDelay: `${100 + index * 80}ms` }}
    >
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-base font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{description}</p>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-20 pb-16 lg:pt-28 lg:pb-24 min-h-[90vh] flex items-center">
        {/* Hero background image with dark gradient overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30 lg:opacity-40"
            style={{
              backgroundImage:
                'url("https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1920&q=80")',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/95 to-background/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent" />
        </div>

        <div className="max-w-6xl mx-auto relative w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <div className="space-y-6 animate-fade-in relative z-10">
              <h1 className="text-fluid-hero font-black leading-[0.92] tracking-tight text-balance">
                Les appels IA que tout{" "}
                <span className="text-primary relative">
                  TikTok
                  <span className="absolute -bottom-1 left-0 right-0 h-1 bg-primary/30 rounded-full blur-sm" />
                </span>{" "}
                va partager
              </h1>

              <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl text-balance text-pretty">
                Crée des conversations absurdes avec des personnages IA délirants, lance des appels
                immersifs, écoute les réactions en direct et transforme chaque moment en contenu
                viral.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link href="/register">
                  <Button size="lg" className="gap-2 text-base px-8">
                    Commencer gratuitement <Zap className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/explore">
                  <Button variant="outline" size="lg" className="gap-2 text-base px-8">
                    Voir une démo
                  </Button>
                </Link>
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-0.5"
                  role="img"
                  aria-label="5 étoiles"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg
                      key={i}
                      className="w-3.5 h-3.5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </span>
                5 crédits offerts &middot; Sans engagement &middot; Annulation à tout moment
              </p>
            </div>

            {/* Right: Call preview (visible on all screens) */}
            <div className="animate-fade-in [animation-delay:200ms]">
              <LiveCallPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Proof ─────────────────────────────── */}
      <CommunityProofStrip />

      {/* ── Features ────────────────────────────────────── */}
      <section className="px-6 py-20 lg:py-28">
        <div className="max-w-6xl mx-auto space-y-20">
          {/* Hero features */}
          {FEATURES_HERO.map((feature, i) => (
            <HeroFeatureCard key={feature.title} {...feature} index={i} />
          ))}

          {/* Supporting features grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            {FEATURES_SUPPORTING.map((feature, i) => (
              <SupportingFeatureCard key={feature.title} {...feature} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Scenarios ──────────────────────────── */}
      <FeaturedScenariosSection />

      {/* ── Final CTA ────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-border animate-fade-in">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />

        <div className="max-w-2xl mx-auto px-6 py-24 text-center relative">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-6">
            <Headphones className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-fluid-section font-black tracking-tight text-balance mb-4">
            Prêt à faire du <span className="text-primary">bruit</span> ?
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-lg mx-auto mb-10 text-pretty">
            Rejoins les milliers de créateurs qui utilisent déjà EchoRoom pour générer des appels IA
            viraux. Ton premier appel est offert.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-base px-10">
                Créer mon compte <Zap className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button variant="outline" size="lg" className="gap-2 text-base px-10">
                Explorer les scénarios
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
