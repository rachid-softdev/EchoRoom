import type { Metadata } from "next"
import LeaderboardPageClient from "./LeaderboardPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Classement — EchoRoom AI",
    description:
      "Découvrez les scénarios et créateurs les plus populaires de la communauté EchoRoom. Votez pour vos favoris et suivez le top des créateurs.",
    openGraph: {
      title: "Classement — EchoRoom AI",
      description:
        "Découvrez les scénarios et créateurs les plus populaires de la communauté EchoRoom.",
      siteName: "EchoRoom AI",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Classement — EchoRoom AI",
      description:
        "Découvrez les scénarios et créateurs les plus populaires de la communauté EchoRoom.",
    },
  }
}

export default function LeaderboardPage() {
  return <LeaderboardPageClient />;
}
