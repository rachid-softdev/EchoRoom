import type { Metadata } from "next";
import SettingsPageClient from "./SettingsPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Paramètres — EchoRoom AI",
    description: "Gérez votre profil, vos préférences et vos données personnelles sur EchoRoom AI.",
    openGraph: {
      title: "Paramètres — EchoRoom AI",
      description:
        "Gérez votre profil, vos préférences et vos données personnelles sur EchoRoom AI.",
      siteName: "EchoRoom AI",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Paramètres — EchoRoom AI",
      description:
        "Gérez votre profil, vos préférences et vos données personnelles sur EchoRoom AI.",
    },
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function SettingsPage() {
  return <SettingsPageClient />;
}
