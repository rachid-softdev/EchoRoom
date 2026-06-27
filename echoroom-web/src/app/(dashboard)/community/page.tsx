import type { Metadata } from "next";
import CommunityPageClient from "./CommunityPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Communauté — EchoRoom AI",
    description:
      "Explorez les meilleurs moments partagés par la communauté EchoRoom : scénarios absurdes, appels IA viraux et discussions animées.",
    openGraph: {
      title: "Communauté — EchoRoom AI",
      description: "Explorez les meilleurs moments partagés par la communauté EchoRoom.",
      siteName: "EchoRoom AI",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Communauté — EchoRoom AI",
      description: "Explorez les meilleurs moments partagés par la communauté EchoRoom.",
    },
  };
}

export default function CommunityPage() {
  return <CommunityPageClient />;
}
