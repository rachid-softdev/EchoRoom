"use client";

import {
  Clock,
  Flame,
  Library,
  Medal,
  MessageCircle,
  Phone,
  Plus,
  Shuffle,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { BadgeGrid } from "@/components/social/BadgeGrid";
import { FeaturedScenario } from "@/components/social/FeaturedScenario";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { formatDate, STATUS_LABELS } from "@/lib/constants";
import { api } from "@/lib/trpc";

const quickActions = [
  {
    label: "Nouvel appel",
    href: "/create",
    icon: Plus,
    description: "Créez un nouveau scénario",
    color: "text-primary",
  },
  {
    label: "Bibliothèque",
    href: "/library",
    icon: Library,
    description: "Vos scénarios sauvegardés",
    color: "text-foreground",
  },
  {
    label: "Historique",
    href: "/history",
    icon: Clock,
    description: "Vos derniers appels",
    color: "text-foreground",
  },
  {
    label: "Communauté",
    href: "/community",
    icon: Users,
    description: "Feed social",
    color: "text-foreground",
  },
];

export default function DashboardPage() {
  // Single batch query replaces 4 separate tRPC calls
  const dashboardQuery = api.dashboard.getData.useQuery({ callsLimit: 5, scenariosLimit: 3 });
  const { data: session } = useSession();

  const credits = dashboardQuery.data?.credits ?? 0;
  const calls = dashboardQuery.data?.calls ?? [];
  const todayCount = dashboardQuery.data?.todayCount ?? 0;
  const scenarios = dashboardQuery.data?.scenarios ?? [];

  return (
    <DashboardShell title="Dashboard">
      {/* ─── Ambient glow ─────────────────────────── */}
      <div className="absolute -inset-20 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      {/* ─── Featured Scenario ────────────────────── */}
      <FeaturedScenario />

      {/* ─── Contextual Pulse Cards ────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {/* Credit card — prominent, cyan-tinted hero */}
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.05] p-5 col-span-2 md:col-span-1">
          <div className="absolute -inset-6 bg-primary/10 blur-3xl rounded-full" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                Crédits
              </span>
            </div>
            <p className="text-4xl font-black tracking-tight">{credits}</p>
            <p className="text-xs text-muted-foreground">
              restants — 5 gratuits à l&apos;inscription
            </p>
          </div>
        </div>

        {/* Today's calls */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Appels aujourd&apos;hui
            </CardTitle>
            <Phone className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{todayCount}</p>
            {todayCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Flame className="w-3 h-3 text-primary" />
                {todayCount > 5 ? "En pleine forme !" : "Bien joué !"}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Scenarios created — or contextual fallback */}
        <Card className="relative overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scénarios créés
            </CardTitle>
            <Sparkles className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scenarios.length}</p>
            {scenarios.length === 0 && (
              <Link
                href="/create"
                className="text-xs text-primary hover:underline mt-1 inline-block"
              >
                Créer mon premier →
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Surprise Me — chaos action card */}
        <Link
          href="/explore?sort=TRENDING"
          className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-all duration-300"
        >
          <div className="absolute -inset-6 bg-primary/[0.03] opacity-0 group-hover:opacity-100 blur-2xl rounded-full transition-opacity duration-500" />
          <div className="relative space-y-2">
            <div className="flex items-center gap-2">
              <Shuffle className="w-4 h-4 text-primary transition-transform duration-300 group-hover:rotate-180" />
              <span className="text-xs font-semibold text-primary tracking-wide uppercase">
                Surprise
              </span>
            </div>
            <p className="text-lg font-bold tracking-tight">Tente ta chance</p>
            <p className="text-xs text-muted-foreground">Un scénario aléatoire tendance</p>
          </div>
        </Link>
      </div>

      {/* ─── Quick Actions ─────────────────────────── */}
      <h2 className="text-xl font-semibold mb-4">Actions rapides</h2>
      <div className="grid md:grid-cols-4 gap-4 mb-10">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="group cursor-pointer transition-all duration-300 hover:border-primary/30 hover:-translate-y-0.5 h-full">
                <CardHeader>
                  <Icon
                    className={`w-8 h-8 mb-2 transition-colors duration-300 ${action.color} group-hover:text-primary`}
                  />
                  <CardTitle className="text-base">{action.label}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ─── Recent Activity ───────────────────────── */}
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-primary" />
        Activité récente
      </h2>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <CardContent className="p-6">
          {calls.length > 0 ? (
            <div className="space-y-1">
              {calls.slice(0, 5).map((call, i) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 -mx-3 transition-colors duration-200 hover:bg-primary/[0.03]"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground/40 w-5 shrink-0 tabular-nums">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-medium truncate">
                        {call.scenario?.title ?? "Appel"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant={
                            call.status === "COMPLETED"
                              ? "secondary"
                              : call.status === "FAILED"
                                ? "destructive"
                                : "outline"
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {STATUS_LABELS[call.status] ?? call.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(call.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {call.status === "COMPLETED" && (
                    <Link href={`/call/${call.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Replay
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <div className="relative inline-flex mb-6">
                <div className="absolute -inset-4 bg-primary/10 blur-2xl rounded-full" />
                <Phone className="w-12 h-12 text-muted-foreground mx-auto relative" />
              </div>
              <p className="text-lg font-semibold mb-2">Pas encore d&apos;appels</p>
              <p className="text-sm text-muted-foreground mb-8 max-w-xs mx-auto">
                Lance-toi ! Crée un scénario absurde et partage-le avec la communauté.
              </p>
              <Link href="/create">
                <Button size="lg" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Créer mon premier scénario
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Badges ─────────────────────────────────── */}
      <div className="mt-12 mb-2">
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Medal className="w-5 h-5 text-primary" />
          Vos badges
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Débloque des badges en enchaînant les appels et en participant à la communauté.
        </p>
      </div>
      {session?.user?.id ? (
        <BadgeGrid userId={session.user.id} />
      ) : (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Medal className="w-4 h-4" />
          <span>Connectez-vous pour voir vos badges</span>
        </div>
      )}
    </DashboardShell>
  );
}
