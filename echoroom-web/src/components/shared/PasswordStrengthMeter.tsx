'use client'

import { useMemo } from 'react'

interface PasswordStrengthMeterProps {
  password: string
}

const CHECKS: Array<{ test: (p: string) => boolean; label: string }> = [
  { test: (p) => p.length >= 8, label: '8 caractères minimum' },
  { test: (p) => p.length >= 12, label: '12 caractères minimum' },
  { test: (p) => /[A-Z]/.test(p), label: 'Une lettre majuscule' },
  { test: (p) => /[0-9]/.test(p), label: 'Un chiffre' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'Un caractère spécial' },
]

const LABELS = ['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort']
const COLORS = [
  'bg-destructive',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-lime-500',
  'bg-green-500',
]

function getScore(password: string): number {
  return CHECKS.reduce((acc, check) => acc + (check.test(password) ? 1 : 0), 0)
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const score = useMemo(() => getScore(password), [password])

  if (!password) return null

  const labelIndex = Math.min(score, LABELS.length - 1)

  return (
    <div className="space-y-2">
      {/* Segmented bar */}
      <div className="flex gap-1">
        {CHECKS.map((_, index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index < score ? COLORS[Math.min(index, COLORS.length - 1)] : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      <p className="text-xs text-muted-foreground">
        Force : {LABELS[labelIndex]}
      </p>

      {/* Individual check list */}
      <ul className="space-y-0.5">
        {CHECKS.map((check, index) => (
          <li key={index} className="text-xs text-muted-foreground flex items-center gap-1">
            <span className={check.test(password) ? 'text-green-500' : 'text-destructive'}>
              {check.test(password) ? '✓' : '✗'}
            </span>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
