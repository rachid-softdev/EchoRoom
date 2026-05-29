import type { Metadata } from "next"
import BlockedNumbersPageClient from "./BlockedNumbersPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Numéros bloqués — EchoRoom AI",
    description:
      "Gérez la liste des numéros de téléphone bloqués sur EchoRoom AI.",
    robots: { index: false, follow: false },
  }
}

export default function BlockedNumbersPage() {
  return <BlockedNumbersPageClient />;
}
