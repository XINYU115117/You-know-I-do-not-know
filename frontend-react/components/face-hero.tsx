'use client'

import type { RefObject } from 'react'
import { ArrowRight } from 'lucide-react'

const SUGGESTIONS = [
  '为什么天空是蓝色的？',
  '如何学习一门新语言？',
  '猫为什么会发出呼噜声？',
  '什么是区块链？',
]

export function FaceHero({
  input,
  setInput,
  onStart,
  composingRef,
}: {
  input: string
  setInput: (v: string) => void
  onStart: (q: string) => void
  composingRef: RefObject<boolean>
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      !composingRef.current &&
      e.nativeEvent.isComposing !== true &&
      (e.nativeEvent as unknown as { keyCode?: number }).keyCode !== 229
    ) {
      e.preventDefault()
      onStart(input)
    }
  }

  return (
    <section className="home-page relative flex min-h-[calc(100svh-1px)] w-full flex-col overflow-hidden bg-[#fffef5] px-6 py-7 text-[#050505] sm:px-10 sm:py-9">
      <header className="relative z-20 flex items-center gap-3 text-[clamp(1.15rem,1.45vw,1.8rem)] font-medium tracking-tight">
        <span aria-hidden className="brand-spark">✦</span>
        <span>看看 AI 是如何思考的？</span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center pb-5 pt-5 sm:pt-2">
        <div className="home-visual" aria-label="四个抽象人物组成的思考环">
          <div className="orbit-stage">
            <img
              src="/figma-main.png"
              alt="四个彩色抽象人物组成的思考环"
              className="home-main-visual"
              draggable={false}
            />
          </div>
        </div>

        <form
          className="home-input-wrap"
          onSubmit={(e) => {
            e.preventDefault()
            onStart(input)
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => (composingRef.current = true)}
            onCompositionEnd={() => (composingRef.current = false)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={100}
            aria-label="向 AI 提问"
            placeholder="问AI一个问题，看它怎么生成答案"
            className="home-input"
          />
          <button type="submit" disabled={!input.trim()} className="home-send">
            发送 <ArrowRight className="size-5" strokeWidth={2.4} />
          </button>
        </form>

        <div className="home-examples">
          <span>或者试试这些</span>
          <div className="home-example-list">
            {SUGGESTIONS.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onStart(q)}
                className={`home-example example-${i}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[#8a8a8a]">
          回答由本地小模型生成，可能不准确，请勿作为专业建议
        </p>
      </main>
    </section>
  )
}

