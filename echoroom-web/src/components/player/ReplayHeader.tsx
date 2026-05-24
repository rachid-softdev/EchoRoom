import { Badge } from '@/components/ui'
import { Phone, Clock, Calendar } from 'lucide-react'

interface ReplayHeaderProps {
  scenarioTitle?: string
  characterName?: string
  durationSeconds?: number
  status?: string
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m} min ${s}s` : `${s}s`
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Terminé',
  FAILED: 'Échoué',
}

export function ReplayHeader({
  scenarioTitle,
  characterName,
  durationSeconds,
  status,
}: ReplayHeaderProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
        <Phone className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Scénario</p>
          <p className="text-sm font-medium truncate">
            {scenarioTitle ?? '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
        <Phone className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Personnage</p>
          <p className="text-sm font-medium truncate">
            {characterName ?? '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
        <Clock className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Durée</p>
          <p className="text-sm font-medium">
            {durationSeconds !== undefined
              ? formatDuration(durationSeconds)
              : '-'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/50">
        <Calendar className="w-5 h-5 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Statut</p>
          <Badge
            variant={
              status === 'COMPLETED' ? 'secondary' : 'outline'
            }
            className="text-[10px]"
          >
            {STATUS_LABELS[status ?? ''] ?? status ?? '-'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
