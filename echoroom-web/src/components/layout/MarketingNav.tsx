"use client";

import { Loader2, Phone } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui";

export function MarketingNav() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-primary" />
          <span className="text-base font-bold">EchoRoom</span>
        </Link>

        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <Button variant="ghost" size="sm" disabled>
              <Loader2 className="w-4 h-4 animate-spin" />
            </Button>
          ) : session ? (
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Connexion
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
