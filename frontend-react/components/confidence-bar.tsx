'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Candidate } from '@/lib/api'
import { cn } from '@/lib/utils'

function confidenceLabel(top: number) {
  if (top >= 0.6) return { label: '比较确定', tone: 'text-primary' }
  if (top >= 0.4) return { label: '有点犹豫', tone: 'text-accent-foreground' }
  return { label: '不太确定', tone: 'text-muted-foreground' }
}

export function ConfidenceBar({ candidates }: { candidates: Candidate[] }) {
  const [open, setOpen] = useState(false)
  const top = candidates[0]?.prob ?? 0
  const segments = 10
  const filled = Math.round(top * segments)
  const { label, tone } = confidenceLabel(top)

  return (
    <div className="w-full rounded-2xl bg-transparent p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">AI 信心</span>
        <span className={cn('text-sm font-semibold', tone)}>{label}</span>
      </div>

      <div className="mt-3 flex gap-1" aria-hidden>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-3 flex-1 rounded-full transition-colors duration-300',
              i < filled ? 'bg-pop-blue' : 'bg-muted',
            )}
            style={{ transitionDelay: `${i * 30}ms` }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        aria-expanded={open}
      >
        真实概率
        <ChevronDown
          className={cn('size-3.5 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul className="mt-3 space-y-2 animate-ai-rise">
          {candidates.map((c, i) => (
            <li key={c.text + i} className="flex items-center gap-3">
              <span
                className={cn(
                  'w-24 shrink-0 truncate font-mono text-sm',
                  i === 0 ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {c.text}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full', i === 0 ? 'bg-pop-lime' : 'bg-pop-purple/60')}
                  style={{ width: `${Math.round(c.prob * 100)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                {Math.round(c.prob * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
