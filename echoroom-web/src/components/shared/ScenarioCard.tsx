"use client"

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui'
import { Badge } from '@/components/ui'
import { Button } from '@/components/ui'
import { toast } from "@/components/ui";
import { Heart, MessageCircle, Play, Share2 } from 'lucide-react'
import { CATEGORY_LABELS } from '@/lib/constants'

interface ScenarioCardData {
  id: string
  title: string
  description: string
  character?: { name: string; slug?: string; category?: string }
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

export function ScenarioCard({
  scenario,
  href = `/scenario/${scenario.id}`,
  showCreator = true,
  showShare = false,
}: ScenarioCardProps) {
  const categoryLabel =
    CATEGORY_LABELS[scenario.character?.category ?? ''] ?? 'Scénario'

  return (
    <Link href={href} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl">
      <Card className="group cursor-pointer hover:border-primary/30 transition-colors h-full">
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
          <CardTitle className="text-base group-hover:text-primary transition-colors" title={scenario.title}>
            {scenario.title}
          </CardTitle>
          <CardDescription className="line-clamp-2" title={scenario.description}>
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
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const url = `${window.location.origin}/scenario/${scenario.id}`
                    try {
                      await navigator.clipboard.writeText(url)
                      toast({ title: "Lien copié !", variant: "success" });
                    } catch {
                      // Clipboard access denied — fail silently
                    }
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
