import type { Metadata } from "next";
import ReportsPageClient from "./ReportsPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Signalements — EchoRoom AI",
    description: "Gérez les signalements de contenu abusif sur EchoRoom AI.",
    robots: { index: false, follow: false },
  };
}

export default function ReportsPage() {
  return <ReportsPageClient />;
}
