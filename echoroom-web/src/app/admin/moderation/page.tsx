import type { Metadata } from "next"
import ModerationPageClient from "./ModerationPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Modération — EchoRoom AI",
    description:
      "File de modération des scénarios en attente de validation sur EchoRoom AI.",
    robots: { index: false, follow: false },
  }
}

export default function ModerationPage() {
  return <ModerationPageClient />;
}
