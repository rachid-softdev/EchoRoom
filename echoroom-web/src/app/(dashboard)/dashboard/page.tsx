"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import {
  Phone,
  Plus,
  Library,
  Clock,
  CreditCard,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { api } from "@/lib/trpc";
import { FeaturedScenario } from "@/components/social/FeaturedScenario";
import { STATUS_LABELS, formatDate } from "@/lib/constants";

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
  const creditsQuery = api.billing.getCredits.useQuery();
  const callsQuery = api.calls.history.useQuery({ limit: 5 });
  const todayCountQuery = api.calls.todayCount.useQuery();
  const scenariosQuery = api.scenarios.myScenarios.useQuery({ limit: 3 });

  const credits = creditsQuery.data?.credits ?? 0;
  const calls = callsQuery.data?.items ?? [];
  const scenarios = scenariosQuery.data?.items ?? [];

  return (
    <DashboardShell title="Dashboard">
      {/* ─── Featured Scenario ────────────────────── */}
      <FeaturedScenario />

      {/* ─── Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Crédits restants
            </CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{credits}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Appels aujourd&apos;hui
            </CardTitle>
            <Phone className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{todayCountQuery.data?.count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Scénarios créés
            </CardTitle>
            <Sparkles className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{scenarios.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vues totales
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Quick Actions ─────────────────────────── */}
      <h2 className="text-xl font-semibold mb-4">Actions rapides</h2>
      <div className="grid md:grid-cols-4 gap-4 mb-10">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <Card className="border-border/50 cursor-pointer hover:border-primary/30 transition-colors h-full">
                <CardHeader>
                  <Icon className={`w-8 h-8 mb-2 ${action.color}`} />
                  <CardTitle className="text-base">{action.label}</CardTitle>
                  <CardDescription>{action.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ─── Recent Activity ───────────────────────── */}
      <h2 className="text-xl font-semibold mb-4">Activité récente</h2>
      <Card className="border-border/50">
        <CardContent className="p-6">
          {calls.length > 0 ? (
            <div className="space-y-3">
              {calls.slice(0, 5).map((call) => (
                <div
                  key={call.id}
                  className="flex items-center justify-between py-2 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0">
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
                  {call.status === "COMPLETED" && (
                    <Link href={`/call/${call.id}`}>
                      <Button variant="ghost" size="sm">
                        Replay
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <Phone className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">
                Aucun appel pour le moment
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Créez votre premier scénario et lancez un appel !
              </p>
              <Link href="/create">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Créer un scénario
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
