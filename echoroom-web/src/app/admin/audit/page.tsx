import type { Metadata } from "next";
import AuditPageClient from "./AuditPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Journal d'audit — EchoRoom AI",
    description: "Consultez l'historique des actions administratives sur EchoRoom AI.",
    robots: { index: false, follow: false },
  };
}

export default function AuditPage() {
  return <AuditPageClient />;
}
