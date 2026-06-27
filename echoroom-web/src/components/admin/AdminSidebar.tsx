"use client";

import { Ban, BarChart3, Flag, LayoutDashboard, ScrollText, Shield, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const navItems = [
  { href: "/admin/moderation", label: "Modération", icon: Shield },
  { href: "/admin/reports", label: "Signalements", icon: Flag },
  { href: "/admin/audit", label: "Journal d'audit", icon: ScrollText },
  { href: "/admin/blocked-numbers", label: "Numéros bloqués", icon: Ban },
  { href: "/admin/users", label: "Utilisateurs", icon: Users },
  { href: "/admin/analytics", label: "Analytiques", icon: BarChart3 },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 h-full border-r border-border bg-background flex flex-col">
      <div className="p-4 border-b border-border">
        <Link href="/admin/moderation" className="flex items-center gap-2 text-sm font-semibold">
          <LayoutDashboard className="w-4 h-4 text-primary" />
          <span>EchoRoom Admin</span>
        </Link>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <ThemeToggle />
      </div>
    </aside>
  );
}
