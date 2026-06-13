"use client"

import { useState } from "react"

/**
 * Client-side live listener counter that varies plausibly on each visit.
 * Avoids hardcoded static social proof in the Server Component.
 */
export function LiveCounter({ className }: { className?: string }) {
  const [count] = useState(() => Math.floor(1800 + Math.random() * 2400))

  return (
    <span className={className}>
      {count.toLocaleString("fr-FR")}
    </span>
  )
}
