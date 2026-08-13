'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ArrowRight, Lightbulb, Scissors, Sparkles } from 'lucide-react'
import { connectSSE, getConversationId, answerOf, type Example, type GenStep, type Candidate } from '@/lib/api'
import { StageProgress, type Phase } from '@/components/stage-progress'
import { FaceHero } from '@/components/face-hero'
import { Sticker } from '@/components/sticker'
import { FragmentChip } from '@/components/fragment-chip'
import { PredictionCards } from '@/components/prediction-cards'
import { ConfidenceBar } from '@/components/confidence-bar'
import { ReviewCard } from '@/components/review-card'
import { cn } from '@/lib/utils'

const KEYWORD_STYLES: { shape: 'seal' | 'blob' | 'hex' | 'petal' | 'diamond'; color: 'pop-orange' | 'pop-pink' | 'pop-blue' | 'pop-lime' | 'pop-purple'; rotate: number }[] = [
  { shape: 'seal', color: 'pop-orange', rotate: -5 },
  { shape: 'blob', color: 'pop-pink', rotate: 4 },
  { shape: 'hex', color: 'pop-blue', rotate: -3 },
  { shape: 'petal', color: 'pop-lime', rotate: 3 },
  { shape: 'diamond', color: 'pop-purple', rotate: -4 },
]

export function AiExperience() {
  const [phase, setPhase] = useState<Phase>('input')
  const [input, setInput] = useState('')
  const [example, setExample] = useState<Example | null>(null)

  const [activeStep, setActiveStep] = useState(0)
  const [committing, setCommitting] = useState(false)
  const [committedTokens, setCommittedTokens] = useState<string[]>([])
  const [predictionDone, setPredictionDone] = useState(false)
  const [error, setError] = useState('')

  const composingRef = useRef(false)
  const disconnectRef = useRef<(() => void) | null>(null)
  const stepsRef = useRef<GenStep[]>([])       // SSE 实时缓冲
  const doneRef = useRef(false)                 // 后端是否已结束

  const organizingStartRef = useRef(0)

  function start(question: string) {
    const q = question.trim()
    if (!q) return
    setInput('')
    setActiveStep(0)
    setCommitting(false)
    setCommittedTokens([])
    setPredictionDone(false)
    setError('')
    setExample(null)  // 不移除：fragments/predicting 需要 example 非空才渲染
    stepsRef.current = []
    doneRef.current = false
    setPhase('organizing')
    organizingStartRef.current = Date.now()

    disconnectRef.current?.()
    let metaReceived = false
    const fallbackTimer = setTimeout(() => {
      if (!metaReceived) {
        setError('无法连接模型服务，请检查后端是否运行')
        setPhase('input')
      }
    }, 15000)

    const cleanup = connectSSE(q, getConversationId(), {
      onMeta: (ex) => {
        metaReceived = true
        clearTimeout(fallbackTimer)
        setExample(ex)
        // meta 数据到达即跳 fragments，但至少展示 1500ms 整理动画
        const remaining = Math.max(0, 1500 - (Date.now() - organizingStartRef.current))
        if (remaining > 0) {
          setTimeout(() => setPhase('fragments'), remaining)
        } else {
          setPhase('fragments')
        }
      },
      onStep: (step) => {
        stepsRef.current.push(step)
      },
      onDone: () => {
        doneRef.current = true
      },
      onError: (msg) => {
        clearTimeout(fallbackTimer)
        setError(msg)
        setPhase('input')
      },
    })
    disconnectRef.current = () => {
      clearTimeout(fallbackTimer)
      cleanup()
    }
  }

  function restart() {
    disconnectRef.current?.()
    setPhase('input')
    setExample(null)
    setInput('')
    setActiveStep(0)
    setCommitting(false)
    setCommittedTokens([])
    setPredictionDone(false)
    setError('')
    stepsRef.current = []
    doneRef.current = false
  }

  // Prediction playback（自动播放，步进节奏基于缓冲的 steps 数组）
  useEffect(() => {
    if (phase !== 'predicting') return

    const steps = stepsRef.current
    if (activeStep >= steps.length) {
      if (doneRef.current) {
        const t = setTimeout(() => setPredictionDone(true), 700)
        return () => clearTimeout(t)
      }
      // 还没收到下一步，50ms 轮询
      const interval = setInterval(() => {
        if (stepsRef.current.length > activeStep || doneRef.current) {
          setActiveStep((s) => s) // 触发重渲染：读到新 steps
        }
      }, 50)
      return () => clearInterval(interval)
    }

    const step = steps[activeStep]
    const hesitation = step.candidates[0].prob < 0.3
    const showMs = hesitation ? 1000 : 450

    setCommitting(false)
    const t1 = setTimeout(() => {
      setCommitting(true)
      setCommittedTokens((prev) => [...prev, step.selectedText])
    }, showMs)
    const t2 = setTimeout(() => {
      setActiveStep((s) => s + 1)
    }, showMs + 200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [phase, activeStep])

  const currentStep =
    activeStep < stepsRef.current.length ? stepsRef.current[activeStep] : null
  const hesitating = currentStep ? currentStep.candidates[0].prob < 0.5 && !committing : false

  return (
    <div className={phase === 'input' ? 'w-full' : 'mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-6 sm:py-10'}>
      {phase !== 'input' && phase !== 'organizing' && (
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight">AI 是怎么想的？</span>
          </div>
          <button
            type="button"
            onClick={restart}
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            重新开始
          </button>
        </header>
      )}

      {phase !== 'input' && (
        <div className={`${phase === 'organizing' ? 'organizing-progress pt-7' : phase === 'fragments' ? 'fragments-progress mt-6' : phase === 'predicting' ? 'predicting-progress mt-6' : phase === 'review' ? 'review-progress mt-6' : 'mt-6'}`}>
          <StageProgress phase={phase} />
        </div>
      )}

      <main className={phase === 'input' ? 'w-full' : 'flex flex-1 flex-col items-center justify-center py-8'}>
        {phase === 'input' && (
          <FaceHero input={input} setInput={setInput} onStart={start} composingRef={composingRef} />
        )}

        {phase === 'organizing' && (
          <OrganizingStage example={example} />
        )}

        {phase !== 'input' && phase !== 'organizing' && (
          <div className="flat-stage relative mx-auto w-full max-w-3xl animate-ai-rise">
            <div className="relative px-4 pb-6 pt-4 sm:px-7 sm:pb-8 sm:pt-6">
              {phase === 'fragments' && (
                <FragmentsStage example={example} onNext={() => setPhase('predicting')} />
              )}

              {phase === 'predicting' && (
                <section className="animate-ai-rise">
                  <QuestionLabel question={example?.question ?? ''} />

                  <div className="prediction-answer mt-5 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      AI 正在拼出的回答
                    </p>
                    <p className="mt-2 min-h-8 text-lg leading-relaxed text-foreground">
                      {committedTokens.map((t, i) => (
                        <span
                          key={i}
                          className={cn(
                            'inline animate-ai-pop',
                            i === committedTokens.length - 1 &&
                              committing &&
                              'rounded bg-pop-yellow px-0.5 text-ink',
                          )}
                        >
                          {t}
                        </span>
                      ))}
                      {!predictionDone && (
                        <span className="ml-0.5 inline-block h-5 w-1 translate-y-0.5 animate-pulse bg-accent align-middle" />
                      )}
                    </p>
                  </div>

                  {!predictionDone && !currentStep && (
                    <p className="text-center text-sm text-muted-foreground mt-6 animate-pulse">
                      正在等待 AI 思考…
                    </p>
                  )}

                  {!predictionDone && currentStep && (
                    <div className="mt-6 space-y-4">
                      <div className="prediction-heading flex items-center gap-2">
                        <Sparkles className="size-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">
                          AI 正在选择下一块拼图
                        </p>
                      </div>

                      {hesitating && (
                        <div className="prediction-note flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground animate-ai-rise">
                          <Lightbulb className="size-4" />
                          AI 有一点犹豫 —— 好几个方向都挺可能
                        </div>
                      )}

                      <PredictionCards
                        candidates={currentStep.candidates}
                        committing={committing}
                        selectedText={currentStep.selectedText}
                        selectedRank={currentStep.selectedRank}
                      />
                      <ConfidenceBar candidates={currentStep.candidates} />

                      <p className="text-center text-xs text-muted-foreground">
                        AI 不是找到唯一答案，而是在多个可能中选择。
                      </p>
                    </div>
                  )}

                  {predictionDone && (
                    <div className="mt-8 flex flex-col items-center gap-4 animate-ai-rise">
                      <p className="text-sm text-muted-foreground">
                        回答生成完成 · 一共预测了 {stepsRef.current.length} 次
                      </p>
                      <button
                        type="button"
                        onClick={() => setPhase('review')}
                        className="prediction-button btn-retro bg-ink text-sm text-paper"
                      >
                        看看刚才发生了什么
                        <ArrowRight className="size-4" />
                      </button>
                    </div>
                  )}
                </section>
              )}

              {phase === 'review' && (
                <section>
                  <QuestionLabel question={example?.question ?? ''} />
                  <div className="mt-5">
                    <ReviewCard
                      answer={answerOf(stepsRef.current)}
                      onRestart={restart}
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function QuestionLabel({ question }: { question: string }) {
  return (
    <div className="flex items-start gap-2">
      <Sticker shape="pill" color="pop-blue" rotate={-3} className="mt-0.5 shrink-0 text-[11px]">
        <span className="px-2.5 py-0.5 font-semibold text-ink">你问</span>
      </Sticker>
      <p className="text-pretty text-base font-medium text-foreground">{question}</p>
    </div>
  )
}

function OrganizingStage({ example }: { example: Example | null }) {
  const keywords = example?.keywords ?? []
  return (
    <section className="organizing-stage mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center justify-center px-5 py-12 text-center sm:px-8">
      <div className="organizing-mark" aria-hidden>
        <Scissors className="size-5" />
      </div>
      <p className="mt-5 text-base font-medium tracking-wide text-foreground sm:text-lg">
        AI 正在整理你的问题…
      </p>
      {keywords.length > 0 && (
        <div className="organizing-keywords" aria-label="正在提取的问题关键词">
          {keywords.map((k, i) => {
            const s = KEYWORD_STYLES[i % KEYWORD_STYLES.length]
            return (
              <div
                key={k + i}
                className={`organizing-keyword organizing-keyword-${i % 4} animate-ai-float`}
                style={{ animationDelay: `${i * 300}ms` }}
              >
                <span className="font-semibold text-ink">{k}</span>
              </div>
            )
          })}
        </div>
      )}
      <p className="mt-12 max-w-sm text-sm leading-relaxed text-muted-foreground">
        人类看到一句话，AI 看到的是很多信息碎片。
      </p>
    </section>
  )
}

function FragmentsStage({ example, onNext }: { example: Example; onNext: () => void }) {
  return (
    <section className="fragments-stage">
      <QuestionLabel question={example?.question ?? ''} />

      <div className="mt-6 flex flex-wrap justify-center gap-4">
        {example?.fragments.map((f, i) => (
          <FragmentChip key={f.text + i} fragment={f} index={i} />
        ))}
      </div>

      <div className="flat-note mx-auto mt-8 max-w-md p-4 text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">点一下</span>
          任意碎片 —— AI 不会像人一样理解文字，它会把文字换成数字来计算。
        </p>
      </div>

      <div className="mt-8 flex justify-center">
        <button type="button" onClick={onNext} className="btn-retro bg-ink text-sm text-paper">
          看 AI 如何预测下一步
          <ArrowRight className="size-4" />
        </button>
      </div>
    </section>
  )
}
