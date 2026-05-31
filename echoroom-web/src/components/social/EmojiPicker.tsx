"use client"

import { cn } from "@/components/ui"

const EMOJIS = ["❤️", "😂", "😮", "🔥", "😭", "🤯", "💀", "👀"]

interface EmojiPickerProps {
  selectedEmoji?: string
  onSelect: (emoji: string) => void
  disabled?: boolean
}

export function EmojiPicker({
  selectedEmoji,
  onSelect,
  disabled = false,
}: EmojiPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {EMOJIS.map((emoji) => {
        const isSelected = selectedEmoji === emoji
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md text-sm transition-all",
              "hover:bg-primary/10 hover:scale-110",
              "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-transparent",
              isSelected && "bg-primary/20 ring-1 ring-primary scale-110",
            )}
            aria-label={`Réagir avec ${emoji}`}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
