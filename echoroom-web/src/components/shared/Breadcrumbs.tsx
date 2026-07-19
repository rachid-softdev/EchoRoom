"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs as BreadcrumbsUI, type BreadcrumbItem } from "@echoroom/ui";

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

/**
 * Auto-generated breadcrumbs for the authenticated areas of the app.
 *
 * The trail is derived from the current pathname; rendering is delegated to the
 * shared @echoroom/ui Breadcrumbs organism (via `linkComponent={Link}` so we keep
 * client-side navigation and a Home icon as the leading crumb).
 */
export function Breadcrumbs() {
  const pathname = usePathname();

  // Only show breadcrumbs inside dashboard / admin routes
  if (!pathname?.startsWith("/dashboard") && !pathname?.startsWith("/admin")) {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    href: `/${segments.slice(0, index + 1).join("/")}`,
    label: LABEL_MAP[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1),
  }));

  // If we're exactly at /dashboard or /admin, only show the home link
  if (crumbs.length <= 1) return null;

  const items: BreadcrumbItem[] = [
    { href: "/dashboard", label: <Home className="h-4 w-4" aria-hidden="true" />, ariaLabel: "Accueil" },
    ...crumbs.map((crumb) => ({ href: crumb.href, label: crumb.label })),
  ];

  return (
    <div className="mb-6">
      <BreadcrumbsUI
        items={items}
        separator={<ChevronRight className="h-4 w-4" aria-hidden />}
        linkComponent={Link}
      />
    </div>
  );
}
