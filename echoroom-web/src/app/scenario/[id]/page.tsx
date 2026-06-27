import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { ScenarioDetailClient } from "./ScenarioDetailClient";

interface ScenarioPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: ScenarioPageProps): Promise<Metadata> {
  const scenario = await db.scenario.findUnique({
    where: { id: params.id },
    select: {
      title: true,
      description: true,
      visibility: true,
      character: {
        select: { name: true, avatarUrl: true },
      },
      creator: {
        select: { username: true },
      },
    },
  });

  // For non-public scenarios, return generic metadata
  if (!scenario || scenario.visibility === "PRIVATE" || scenario.visibility === "UNLISTED") {
    return {
      title: "EchoRoom AI",
      description:
        "Créez des appels IA absurdes, partagez des moments viraux et explorez une communauté de scénarios sociaux générés par l'intelligence artificielle.",
      openGraph: {
        title: "EchoRoom AI",
        description:
          "Créez des appels IA absurdes, partagez des moments viraux et explorez une communauté de scénarios sociaux.",
        siteName: "EchoRoom AI",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: "EchoRoom AI",
        description: "Créez des appels IA absurdes, partagez des moments viraux.",
      },
    };
  }

  const ogTitle = `${scenario.title} — EchoRoom AI`;
  const ogDescription =
    scenario.description?.slice(0, 160) ??
    `Un scénario ${scenario.character?.name ?? "EchoRoom"} créé par ${scenario.creator?.username ?? "un membre"}`;
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const ogUrl = `${appUrl}/api/og?id=${params.id}`;

  return {
    title: ogTitle,
    description: ogDescription,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      siteName: "EchoRoom AI",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [ogUrl],
    },
  };
}

export default async function ScenarioPage({ params }: ScenarioPageProps) {
  // Basic server-side validation: check scenario exists
  const scenario = await db.scenario.findUnique({
    where: { id: params.id },
    select: { id: true },
  });

  if (!scenario) {
    notFound();
  }

  return <ScenarioDetailClient scenarioId={params.id} />;
}
