import type { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Phone, Users, Activity, TrendingUp } from "lucide-react";

const stats = [
  { label: "Utilisateurs total", value: "—", icon: Users },
  { label: "Appels total", value: "—", icon: Phone },
  { label: "Scénarios créés", value: "—", icon: Activity },
  { label: "Revenus", value: "—", icon: TrendingUp },
];

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Analytiques — EchoRoom AI",
    description:
      "Tableau de bord analytique de la plateforme EchoRoom AI.",
    robots: { index: false, follow: false },
  }
}

export default function AnalyticsPage() {
  return (
    <section className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-8">Analytiques</h1>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-border/50">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              Les données analytiques complètes seront disponibles après le déploiement.
            </p>
          </CardContent>
        </Card>
      </section>
    );
  }
