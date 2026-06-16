'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, LayoutDashboard, PlusCircle, Library, Clock, Users, Trophy, CreditCard, Phone } from 'lucide-react'
import { Button, cn } from '@/components/ui'
import { CreditDisplay } from './CreditDisplay'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Breadcrumbs } from './Breadcrumbs'

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
  /** User object for SSR mode. When provided, skips `useSession()` for user data. */
  user?: {
    id: string
    email: string
    username: string
    role: "USER" | "ADMIN" | "MODERATOR"
    image: string | null
  } | null
}

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col min-h-screen">
      {/* Persistent top navigation */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-6 py-3 border-b border-border bg-background/80 backdrop-blur-sm shadow-sm">
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent pointer-events-none" />
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0 group">
          <div className="relative">
            <Phone className="w-5 h-5 text-primary transition-transform duration-300 group-hover:scale-110" />
            <div className="absolute -inset-2 bg-primary/10 blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full" />
          </div>
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
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[0_0_12px_-4px] shadow-primary/20"
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
          <ThemeToggle />
          <Link href="/settings">
            <Button variant="ghost" size="icon" aria-label="Paramètres">
              <Settings className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </nav>

      <section className="relative flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
        {/* Ambient glow behind content */}
        <div className="absolute -inset-40 bg-gradient-to-b from-primary/[0.02] via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <Breadcrumbs />
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>
      </section>
    </div>
  )
}
