"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function PublicHeader() {
  const pathname = usePathname();

  // Hide on routes that have their own navigation
  if (
    !pathname ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname === "/explore" ||
    pathname === "/pricing" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/legal")
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="font-bold text-lg">
          EchoRoom
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/explore"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Explorer
          </Link>
          <Link
            href="/community/leaderboard"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Classement
          </Link>
          <Link
            href="/help"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Aide
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
