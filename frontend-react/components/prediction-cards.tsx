'use client'

import type { Candidate } from '@/lib/api'
import { displayToken } from '@/lib/api'
import { cn } from '@/lib/utils'

// 概率条颜色：低饱和但不与背景混淆，选中态仍清晰可辨
const TRACKS = ['#7a9cbf', '#a08ca8', '#d99578', '#c97886']

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
            {/* 真实概率进度条：占满整个高度，右端圆角与卡片一致 */}
            <div
              className={cn(
                'absolute inset-y-0 left-0 z-0 rounded-r-full transition-all duration-500',
                chosen && committing ? 'opacity-60' : 'opacity-90',
              )}
              style={{ width: `${Math.max(pct, 3)}%`, background: TRACKS[i % TRACKS.length] }}
              aria-hidden
            />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="font-semibold text-foreground">
                {displayToken(c.text)}
              </span>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
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
