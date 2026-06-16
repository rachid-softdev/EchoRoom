import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s — EchoRoom AI",
      default: "Dashboard — EchoRoom AI",
    },
    description:
      "Gérez vos appels, scénarios et abonnements depuis votre tableau de bord EchoRoom AI.",
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <>{children}</>;
}
