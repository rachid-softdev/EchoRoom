import type { Metadata } from "next"
import { db } from "@/server/db"
import { DashboardShell } from "@/components/shared/DashboardShell"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui"
import { User, Construction } from "lucide-react"

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
      openGraph: {
        title: "Profil introuvable — EchoRoom AI",
        description: "Ce profil n'existe pas sur EchoRoom AI.",
        siteName: "EchoRoom AI",
        type: "website",
      },
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

export default function ProfilePage({ params }: ProfilePageProps) {
  return (
    <DashboardShell
      title={params.username}
      subtitle="Profil public"
    >
      <Card className="border-border/50">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {params.username}
              </CardTitle>
              <CardDescription>Membre EchoRoom</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Construction className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">
              Profil disponible prochainement
            </p>
            <p className="text-sm text-muted-foreground max-w-md">
              Nous travaillons sur une page de profil complète avec
              statistiques, badges et scénarios créés. Revenez bientôt !
            </p>
          </div>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
