'use client'

import type { Candidate } from '@/lib/api'
import { cn } from '@/lib/utils'

const TRACKS = ['#628eae', '#9a8fa8', '#d99578', '#c97886']

export function PredictionCards({
  candidates,
  committing,
  selectedText,
  selectedRank,
}: {
  candidates: Candidate[]
  committing: boolean
  /** 真实被模型选中的 token 文本 */
  selectedText: string
  /** 选中的在 Top-5 中的排名，null = 不在 Top-5 */
  selectedRank: number | null
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {candidates.map((c, i) => {
        const chosen = c.text === selectedText
        const pct = Math.round(c.prob * 100)
        return (
          <div
            key={c.text + i}
            style={{ animationDelay: `${i * 70}ms` }}
            className={cn(
              'prediction-card relative overflow-hidden rounded-[2rem] px-4 py-3 animate-ai-pop transition-all duration-300',
              chosen && committing
                ? 'prediction-card-selected'
                : 'prediction-card-idle',
            )}
          >
            <div
              className={cn(
                'absolute inset-y-0 left-0 z-0 transition-all duration-500',
                chosen && committing ? 'opacity-0' : 'opacity-70',
              )}
              style={{ width: `${pct}%`, background: TRACKS[i % TRACKS.length] }}
              aria-hidden
            />
            <div className="relative flex items-center justify-between gap-3">
              <span
                className={cn(
                  'font-semibold',
                  chosen && committing ? 'text-paper' : 'text-foreground',
                )}
              >
                {c.text}
              </span>
              <span
                className={cn(
                  'font-mono text-sm tabular-nums',
                  chosen && committing ? 'text-paper' : 'text-muted-foreground',
                )}
              >
                {pct}%
              </span>
            </div>
          </div>
        )
      })}
      {selectedRank === null && committing && (
        <p className="sm:col-span-2 text-center text-xs text-pop-orange mt-1">
          模型这一步选中的词不在 Top-5 内（抽签的随机性）
        </p>
      )}
    </div>
  )
}
