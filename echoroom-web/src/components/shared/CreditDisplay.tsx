'use client'

import { useSession } from 'next-auth/react'
import { Badge, Skeleton } from '@/components/ui'
import { Tooltip } from '@/components/ui/tooltip'
import { Phone } from 'lucide-react'

export function CreditDisplay() {
  const { data: session } = useSession()
  const credits = (session?.user as { credits?: number } | undefined)?.credits

  if (credits === undefined) {
    return <Skeleton className="h-5 w-20 rounded-lg" />;
  }

  return (
    <Tooltip content="Chaque appel consomme 1 crédit. 5 gratuits à l&apos;inscription." side="bottom">
      <Badge variant="secondary" className="text-xs cursor-help">
        <Phone className="w-3 h-3 mr-1" />
        {credits} crédits
      </Badge>
    </Tooltip>
  )
}
