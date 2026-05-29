'use client'

import Link from 'next/link'
import { ArrowLeft, Phone, Settings } from 'lucide-react'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import { useCreditBalance } from '@/hooks/useCreditBalance'

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
  const { credits } = useCreditBalance()

  return (
    <div className="flex flex-col min-h-screen">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <Link
          href={backHref}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            <Phone className="w-3 h-3 mr-1" />
            {credits ?? '?'} crédits
          </Badge>
          {actions}
          <Link href="/settings">
            <Button variant="ghost" size="icon">
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
