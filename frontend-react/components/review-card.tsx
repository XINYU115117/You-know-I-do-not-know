'use client'

import { RotateCcw, Scissors, Sparkles, Layers } from 'lucide-react'
import { Sticker, type StickerShape, type StickerColor } from '@/components/sticker'

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

export function ReviewCard({ answer, onRestart }: { answer: string; onRestart: () => void }) {
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

        <blockquote className="review-note mt-6 rounded-2xl px-5 py-4 text-pretty text-sm leading-relaxed text-muted-foreground">
          AI 不是像人一样思考，而是在预测最可能的表达。
        </blockquote>
      </div>

      <div className="mt-6 flex justify-center">
        <button type="button" onClick={onRestart} className="review-button btn-retro bg-ink text-sm text-paper">
          <RotateCcw className="size-4" />
          再问一个问题
        </button>
      </div>
    </div>
  )
}
