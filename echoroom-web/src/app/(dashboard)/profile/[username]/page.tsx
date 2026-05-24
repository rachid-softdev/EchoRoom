"use client"

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
