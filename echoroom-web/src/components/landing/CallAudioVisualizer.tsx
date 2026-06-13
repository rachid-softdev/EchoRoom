"use client"

import { useState } from "react"

/**
 * Client-side audio visualizer bars with stable random heights generated
 * once on mount, avoiding SSR hydration mismatch from Math.random() in JSX.
 */
export function CallAudioVisualizer() {
  const [bars] = useState(() =>
    Array.from({ length: 20 }).map((_, i) => ({
      height: 30 + Math.random() * 70,
      duration: 0.4 + Math.random() * 0.6,
      delay: i * 0.05,
    }))
  )

  return (
    <div className="flex items-center gap-0.5 h-6 px-1" aria-hidden="true">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="w-0.5 rounded-full bg-primary/60 origin-bottom"
          style={{
            height: `${bar.height}%`,
            animation: `audio-bar ${bar.duration}s ease-in-out infinite`,
            animationDelay: `${bar.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
