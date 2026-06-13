import type { Metadata } from "next"
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db"
import { DashboardShell } from "@/components/shared/DashboardShell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
} from "@/components/ui"
import { Calendar, FileAudio, Users, Phone, Sparkles, ArrowRight } from "lucide-react"

interface ProfilePageProps {
  params: { username: string }
}

const ACTIVITY_LIMIT = 10;

async function getProfileData(username: string) {
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      createdAt: true,
      _count: { select: { scenarios: true, calls: true } },
      scenarios: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          title: true,
          createdAt: true,
          playCount: true,
          likeCount: true,
        },
      },
      calls: {
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: {
          id: true,
          createdAt: true,
          status: true,
          durationSeconds: true,
          scenario: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });
  return user;
}

interface ScenarioFeedItem {
  id: string; title: string; createdAt: Date; playCount: number; likeCount: number;
}
interface CallFeedItem {
  id: string; createdAt: Date; status: string; durationSeconds: number;
  scenarioTitle?: string; scenarioId?: string;
}

type ActivityItem =
  | { type: "scenario" } & ScenarioFeedItem
  | { type: "call" } & CallFeedItem;

function buildActivityFeed(
  scenarios: ScenarioFeedItem[],
  calls: CallFeedItem[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const s of scenarios) {
    items.push({ type: "scenario", ...s });
  }
  for (const c of calls) {
    items.push({ type: "call", ...c });
  }

  items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return items.slice(0, ACTIVITY_LIMIT);
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const user = await db.user.findUnique({
    where: { username: params.username },
    select: { username: true },
  })

  if (!user) {
    return {
      title: "Profil introuvable — EchoRoom AI",
      description: "Ce profil n'existe pas sur EchoRoom AI.",
    }
  }

  const title = `${user.username} — EchoRoom AI`
  const description = `Découvrez le profil de ${user.username} sur EchoRoom AI : ses scénarios, son activité et ses statistiques.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "EchoRoom AI",
      type: "profile",
      username: user.username,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const user = await getProfileData(params.username);

  if (!user) {
    notFound();
  }

  const initials = user.username.slice(0, 2).toUpperCase();
  const joinedDate = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
  }).format(user.createdAt);

  const activity = buildActivityFeed(
    user.scenarios.map((s) => ({
      id: s.id, title: s.title, createdAt: s.createdAt,
      playCount: s.playCount, likeCount: s.likeCount,
    })),
    user.calls.map((c) => ({
      id: c.id, createdAt: c.createdAt,
      status: String(c.status), durationSeconds: c.durationSeconds,
      scenarioTitle: c.scenario?.title ?? undefined,
      scenarioId: c.scenario?.id ?? undefined,
    })) as CallFeedItem[]
  );
  const totalItems = user._count.scenarios + user._count.calls;

  return (
    <DashboardShell title={user.username} subtitle="Profil public">
      {/* Profile header card */}
      <Card className="border-border/50 mb-6">
        <CardHeader>
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-primary/20"
              aria-hidden="true"
            >
              <span className="text-xl font-bold text-primary">{initials}</span>
            </div>
            <div className="space-y-0.5">
              <CardTitle className="text-xl">{user.username}</CardTitle>
              <CardDescription className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Membre depuis {joinedDate}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileAudio className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.scenarios}</p>
              <p className="text-xs text-muted-foreground">Scénarios créés</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="flex items-center gap-3 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{user._count.calls}</p>
              <p className="text-xs text-muted-foreground">Appels effectués</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Activité récente
          {totalItems > ACTIVITY_LIMIT && (
            <span className="text-xs font-normal text-muted-foreground">
              ({ACTIVITY_LIMIT} les plus récents)
            </span>
          )}
        </h2>

        {activity.length > 0 ? (
          <div className="space-y-2">
            {activity.map((item) => (
              <div key={`${item.type}-${item.id}`}>
                {item.type === "scenario" ? (
                  <Link href={`/scenario/${item.id}`}>
                    <div className="group flex items-start gap-4 rounded-lg border border-border/50 bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileAudio className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <span>Nouveau scénario</span>
                          <span className="text-muted-foreground/40">&middot;</span>
                          <span>{item.playCount} lectures &middot; {item.likeCount} likes</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(item.createdAt)}</p>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto mt-0.5 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                ) : (
                  <Link href={`/call/${item.id}`}>
                    <div className="group flex items-start gap-4 rounded-lg border border-border/50 bg-card p-4 transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.02]">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Phone className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                          {item.scenarioTitle ?? "Appel"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                          <Badge
                            variant={item.status === "COMPLETED" ? "secondary" : item.status === "FAILED" ? "destructive" : "outline"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {item.status === "COMPLETED" ? "Terminé" : item.status === "FAILED" ? "Échoué" : item.status}
                          </Badge>
                          {item.durationSeconds > 0 && (
                            <>
                              <span className="text-muted-foreground/40">&middot;</span>
                              <span>{item.durationSeconds}s</span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(item.createdAt)}</p>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto mt-0.5 group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 mb-4">
                <Sparkles className="w-7 h-7 text-primary/60" />
              </div>
              <p className="text-base font-semibold mb-1">
                Pas encore d&apos;activité
              </p>
              <p className="text-sm text-muted-foreground max-w-md">
                {user.username} n&apos;a pas encore créé de scénario ou passé d&apos;appel.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
