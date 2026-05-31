'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, LayoutDashboard, PlusCircle, Library, Clock, Users, Trophy, CreditCard, Phone } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import { CreditDisplay } from './CreditDisplay'

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Créer", icon: PlusCircle },
  { href: "/library", label: "Bibliothèque", icon: Library },
  { href: "/history", label: "Historique", icon: Clock },
  { href: "/community", label: "Communauté", icon: Users },
  { href: "/leaderboard", label: "Classement", icon: Trophy },
  { href: "/billing", label: "Facturation", icon: CreditCard },
];

interface DashboardShellProps {
  title: string
  subtitle?: string
  backHref?: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function DashboardShell({
  title,
  subtitle,
  backHref = '/dashboard',
  actions,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col min-h-screen">
      {/* Persistent top navigation */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-background">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
          <Phone className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold tracking-tight hidden sm:inline">EchoRoom</span>
        </Link>
        <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar mx-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CreditDisplay />
          {actions}
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Paramètres">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </section>
    </div>
  )
}
