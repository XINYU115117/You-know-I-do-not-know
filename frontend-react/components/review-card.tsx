'use client'

import { RotateCcw, Scissors, Sparkles, Layers } from 'lucide-react'
import { Sticker, type StickerShape, type StickerColor } from '@/components/sticker'
import { PredictionCards } from '@/components/prediction-cards'
import { QuizCard } from '@/components/quiz-card'
import type { GenStep } from '@/lib/api'

const THINGS: {
  icon: typeof Scissors
  title: string
  desc: string
  shape: StickerShape
  color: StickerColor
}[] = [
  {
    icon: Scissors,
    title: '把问题拆成信息碎片',
    desc: '它先把你的话切成一小块一小块，再换成自己能计算的编号。',
    shape: 'petal',
    color: 'pop-orange',
  },
  {
    icon: Sparkles,
    title: '根据经验预测下一步',
    desc: '每一步，它都在很多可能里挑一个最可能出现的说法。',
    shape: 'blob',
    color: 'pop-pink',
  },
  {
    icon: Layers,
    title: '一个词一个词生成回答',
    desc: '答案不是一次想好的，而是一块一块拼出来的。',
    shape: 'squircle',
    color: 'pop-blue',
  },
]

export function ReviewCard({
  answer,
  highlight,
  onRestart,
  sessionId,
}: {
  answer: string
  highlight: { title: string; desc: string; step: GenStep } | null
  onRestart: () => void
  sessionId: string
}) {
  return (
    <div className="w-full animate-ai-rise">
      <div className="review-answer rounded-2xl p-6 sm:p-8">
        <p className="text-sm font-semibold text-muted-foreground">AI 完成的回答</p>
        <p className="mt-2 text-lg leading-relaxed text-foreground">{answer}</p>
      </div>

      <div className="mt-6">
        <h2 className="text-base font-semibold text-foreground">刚才 AI 做了三件事</h2>
        <ol className="review-things mt-4 grid gap-4 sm:grid-cols-3">
          {THINGS.map((t, i) => {
            const Icon = t.icon
            return (
              <li
                key={t.title}
                style={{ animationDelay: `${i * 120}ms` }}
                className="review-thing rounded-2xl p-5 animate-ai-rise"
              >
                <Sticker shape={t.shape} color={t.color} rotate={i % 2 ? 3 : -3}>
                  <span className="grid size-10 place-items-center text-ink">
                    <Icon className="size-4.5" />
                  </span>
                </Sticker>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  {t.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.desc}</p>
              </li>
            )
          })}
        </ol>

        {highlight && (
          <div className="mt-6 rounded-2xl bg-pop-yellow/15 p-5 animate-ai-rise">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              这一次，最值得看的一步
            </p>
            <p className="mt-2 text-lg font-bold text-ink">{highlight.title}</p>
            <div className="mt-4">
              <PredictionCards
                candidates={highlight.step.candidates}
                committing={true}
                selectedText={highlight.step.selectedText}
                selectedRank={highlight.step.selectedRank}
              />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{highlight.desc}</p>
          </div>
        )}

      </div>

      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onRestart} className="review-button btn-retro bg-ink text-sm text-paper">
          <RotateCcw className="size-4" />
          再问一个问题
        </button>
      </div>

      <QuizCard sessionId={sessionId} />
    </div>
  )
}
