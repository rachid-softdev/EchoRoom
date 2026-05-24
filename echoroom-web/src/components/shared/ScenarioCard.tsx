import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import { Heart, MessageCircle, Play, Share2 } from 'lucide-react'

interface ScenarioCardData {
  id: string
  title: string
  description: string
  character?: { name: string; slug?: string }
  creator?: { username: string }
  _count?: { reactions: number; comments: number }
  playCount?: number
  likeCount?: number
  visibility?: string
}

interface ScenarioCardProps {
  scenario: ScenarioCardData
  href?: string
  showCreator?: boolean
  showShare?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  ROMANTIC: 'Romantique',
  CHAOTIC: 'Chaotique',
  CORPORATE: 'Corporate',
  NPC: 'NPC',
  HORROR: 'Horreur',
  CRINGE: 'Cringe',
  GAMER: 'Gamer',
  WEIRD: 'Weird',
}

export function ScenarioCard({
  scenario,
  href = `/scenario/${scenario.id}`,
  showCreator = true,
  showShare = false,
}: ScenarioCardProps) {
  const categoryLabel =
    CATEGORY_LABELS[scenario.character?.slug?.toUpperCase() ?? ''] ?? 'Scénario'

  return (
    <Link href={href}>
      <Card className="border-border/50 group cursor-pointer hover:border-primary/30 transition-colors h-full">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary">{categoryLabel}</Badge>
            {scenario.playCount !== undefined && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Play className="w-3 h-3" />
                {scenario.playCount > 1000
                  ? `${(scenario.playCount / 1000).toFixed(1)}k`
                  : scenario.playCount}
              </div>
            )}
          </div>
          <CardTitle className="text-base group-hover:text-primary transition-colors">
            {scenario.title}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {scenario.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            {showCreator && scenario.creator && (
              <span>par {scenario.creator.username}</span>
            )}
            <div className="flex items-center gap-3 ml-auto">
              {(scenario.likeCount ?? scenario._count?.reactions) !== undefined && (
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />{' '}
                  {scenario.likeCount ?? scenario._count?.reactions ?? 0}
                </span>
              )}
              {scenario._count && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" />{' '}
                  {scenario._count.comments}
                </span>
              )}
              {showShare && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-6 h-6"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const url = `${window.location.origin}/scenario/${scenario.id}`
                    navigator.clipboard.writeText(url)
                  }}
                >
                  <Share2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
