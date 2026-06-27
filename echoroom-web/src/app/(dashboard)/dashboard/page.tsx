"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { DashboardShell } from "@/components/shared/DashboardShell";
import { api } from "@/lib/trpc";
import { FeaturedScenario } from "@/components/social/FeaturedScenario";
import { useSession } from "next-auth/react";
import { EnergyBar } from "@/components/dashboard/EnergyBar";
import { TrendingFeed } from "@/components/dashboard/TrendingFeed";
import { OnboardingSequence } from "@/components/dashboard/OnboardingSequence";
import { SideWidgets } from "@/components/dashboard/SideWidgets";

export default function DashboardPage() {
  const dashboardQuery = api.dashboard.getData.useQuery({
    callsLimit: 5,
    scenariosLimit: 3,
  });
  const { data: session } = useSession();

  const isLoading = dashboardQuery.isLoading;
  const isError = dashboardQuery.isError;
  const data = dashboardQuery.data;

  const credits = data?.credits ?? 0;
  const calls = data?.calls ?? [];
  const todayCount = data?.todayCount ?? 0;
  const scenarios = data?.scenarios ?? [];

  const isNewUser = calls.length === 0 && scenarios.length === 0;

  return (
    <DashboardShell title="Chaos HQ">
      {/* ─── Ambient glow ─────────────────────────── */}
      <div className="absolute -inset-20 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent pointer-events-none" />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-8">
        {/* ─── Main Column ────────────────────────── */}
        <div className="min-w-0">
          {/* Hero Zone */}
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl mb-8" />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center mb-8">
              <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
              <p className="text-lg font-semibold mb-2">
                Impossible de charger votre tableau de bord
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                {dashboardQuery.error?.message ??
                  "Réessayez dans un instant."}
              </p>
              <Button
                variant="outline"
                onClick={() => dashboardQuery.refetch()}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Réessayer
              </Button>
            </div>
          ) : (
            <>
              {isNewUser ? (
                <OnboardingSequence
                  callsCount={calls.length}
                  scenariosCount={scenarios.length}
                />
              ) : (
                <FeaturedScenario />
              )}
            </>
          )}

          {/* Energy Bar */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={`eb-skel-${i}`} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : isError ? null : (
            <EnergyBar credits={credits} todayCount={todayCount} />
          )}

          {/* Trending Feed (always renders — community content) */}
          <TrendingFeed />
        </div>

        {/* ─── Sidebar ───────────────────────────── */}
        <SideWidgets
          userId={session?.user?.id}
          recentCalls={calls}
        />
      </div>
    </DashboardShell>
  );
}
