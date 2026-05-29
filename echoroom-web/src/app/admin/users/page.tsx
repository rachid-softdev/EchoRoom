import type { Metadata } from "next"
import UsersPageClient from "./UsersPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Admin — Utilisateurs — EchoRoom AI",
    description: "Gestion des utilisateurs de la plateforme EchoRoom AI.",
    robots: { index: false, follow: false },
  }
}

export default function UsersPage() {
  return <UsersPageClient />;
}
