"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@echoroom/ui";

export function MobileNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-b border-border bg-card px-4 py-4 flex flex-col gap-4">
          <Link
            href="/explore"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            Explorer
          </Link>
          <Link
            href="/pricing"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tarifs
          </Link>
          <div className="flex gap-3 pt-2 border-t border-border">
            <Link href="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="w-full">
                Connexion
              </Button>
            </Link>
            <Link href="/register" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full">
                S&apos;inscrire
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
