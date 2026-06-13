"use client"

import { useEffect, useState } from "react"
import { X, Medal } from "lucide-react"
import { cn } from "@/components/ui/lib"

interface BadgeInfo {
  id: string
  name: string
  description: string
  iconUrl: string | null
}

interface BadgeNotificationProps {
  badge: BadgeInfo | null
  onClose?: () => void
}

export function BadgeNotification({ badge, onClose }: BadgeNotificationProps) {
  const [visible, setVisible] = useState(false)
  const [currentBadge, setCurrentBadge] = useState<BadgeInfo | null>(null)

  useEffect(() => {
    if (badge) {
      setCurrentBadge(badge)
      // Trigger enter animation on next frame
      requestAnimationFrame(() => setVisible(true))

      const timer = setTimeout(() => {
        setVisible(false)
        // Allow exit animation to play before removing
        setTimeout(() => {
          setCurrentBadge(null)
          onClose?.()
        }, 200)
      }, 5000)

      return () => clearTimeout(timer)
    }
    return undefined
  }, [badge, onClose])

  if (!currentBadge) return null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm w-full" role="status" aria-live="polite">
      <div
        className={cn(
          "rounded-xl border border-primary/30 bg-card p-4 shadow-lg transition-all duration-200",
          visible
            ? "translate-y-0 opacity-100"
            : "-translate-y-4 opacity-0",
        )}
      >
        <div className="flex items-start gap-3">
          {/* Badge icon */}
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            {currentBadge.iconUrl ? (
              <img
                src={currentBadge.iconUrl}
                alt=""
                className="w-6 h-6"
              />
            ) : (
              <Medal className="w-5 h-5 text-primary" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-primary">
              Badge débloqué ! 🎉
            </p>
            <p className="text-sm font-semibold mt-0.5 truncate">
              {currentBadge.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {currentBadge.description}
            </p>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              setVisible(false)
              setTimeout(() => {
                setCurrentBadge(null)
                onClose?.()
              }, 200)
            }}
            className="shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
