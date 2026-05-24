'use client'

import { useSession } from 'next-auth/react'
import { Badge } from '@/components/ui'
import { Phone } from 'lucide-react'

export function CreditDisplay() {
  const { data: session } = useSession()
  const credits = (session?.user as { credits?: number } | undefined)?.credits

  if (credits === undefined) return null

  return (
    <Badge variant="secondary" className="text-xs">
      <Phone className="w-3 h-3 mr-1" />
      {credits} crédits
    </Badge>
  )
}
