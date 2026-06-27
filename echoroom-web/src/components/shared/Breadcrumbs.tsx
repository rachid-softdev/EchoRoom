"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABEL_MAP: Record<string, string> = {
  dashboard: "Dashboard",
  create: "Créer",
  library: "Bibliothèque",
  history: "Historique",
  community: "Communauté",
  leaderboard: "Classement",
  billing: "Facturation",
  settings: "Paramètres",
  profile: "Profil",
};

export function Breadcrumbs() {
  const pathname = usePathname();

  // Only show breadcrumbs inside dashboard routes
  if (!pathname?.startsWith("/dashboard") && !pathname?.startsWith("/admin")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label = LABEL_MAP[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;

    return { href, label, isLast };
  });

  // If we're exactly at /dashboard or /admin, only show the home link
  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Fil d'Ariane" className="mb-6">
      <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            aria-label="Accueil"
          >
            <Home className="w-4 h-4" />
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1.5">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
            {crumb.isLast ? (
              <span className="font-medium text-foreground" aria-current="page">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:text-foreground transition-colors">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
