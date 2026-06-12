import type { Metadata } from "next"
import { notFound } from "next/navigation";
import { db } from "@/server/db"
import { DashboardShell } from "@/components/shared/DashboardShell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui"
import { User, Calendar, FileAudio, Users } from "lucide-react"

interface ProfilePageProps {
  params: { username: string }
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
  const user = await db.user.findUnique({
    where: { username: params.username },
    select: {
      username: true,
      createdAt: true,
      _count: { select: { scenarios: true, calls: true } },
    },
  })

  if (!user) {
    notFound();
  }

  const initials = user.username.slice(0, 2).toUpperCase();
  const joinedDate = new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "long",
  }).format(user.createdAt);

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

      {/* Content placeholder */}
      <Card className="border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/5 mb-4">
            <FileAudio className="w-7 h-7 text-primary/60" />
          </div>
          <p className="text-base font-semibold mb-1">
            Scénarios à venir
          </p>
          <p className="text-sm text-muted-foreground max-w-md">
            La liste complète des scénarios créés par {user.username} sera
            bientôt disponible ici.
          </p>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
