'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { track } from '@/lib/analytics'

const QUIZ_VERSION = 'v1'

type Option = { key: string; text: string }

const QUESTIONS: {
  qid: string
  q: string
  options: [Option, Option]
  answer: string
  explain: string
}[] = [
  {
    qid: 'q1',
    q: '模型是「选概率最高的词」，还是「按概率抽签」？',
    options: [
      { key: 'greedy', text: '选概率最高的词' },
      { key: 'sample', text: '按概率抽签' },
    ],
    answer: 'sample',
    explain: '模型按概率抽签，所以偶尔会选中概率很低的选项。',
  },
  {
    qid: 'q2',
    q: '同一个问题问两次，答案一定一样吗？',
    options: [
      { key: 'same', text: '一定一样' },
      { key: 'diff', text: '不一定，可能不同' },
    ],
    answer: 'diff',
    explain: '每一步都在抽签，所以同一个问题可能得到不同的答案。',
  },
  {
    qid: 'q3',
    q: '模型是「先想好完整答案」，还是「一个字一个字拼出来」？',
    options: [
      { key: 'whole', text: '先想好完整答案' },
      { key: 'piece', text: '一个字一个字拼出来' },
    ],
    answer: 'piece',
    explain: '答案不是一次想好的，而是一块一块预测、拼接出来的。',
  },
  {
    qid: 'q4',
    q: '模型答错了，是因为它「笨」，还是「它本来就可能答错」？',
    options: [
      { key: 'dumb', text: '它笨' },
      { key: 'prob', text: '它本来就可能答错' },
    ],
    answer: 'prob',
    explain: '模型只是在预测最可能的表达，本来就可能答错。',
  },
]

// 每挂载固定一次的选项展示顺序（[0,1] 的两种排列之一），避免"正确项永远在右边"的偏置
function shuffleOrder(): [number, number] {
  return Math.random() < 0.5 ? [0, 1] : [1, 0]
}

export function QuizCard({ sessionId }: { sessionId: string }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const rootRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)

  // 每题的展示顺序（orders[qi] = [选项下标…]），挂载时固定
  const orders = useMemo(() => QUESTIONS.map(() => shuffleOrder()), [])

  // quiz_started：Quiz 首次滚入视口触发一次
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !startedRef.current) {
          startedRef.current = true
          track('quiz_started', {}, sessionId)
        }
      },
      { threshold: 0.2 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [sessionId])

  const answeredCount = Object.keys(answers).length
  const allDone = answeredCount === QUESTIONS.length

  const correctCount = QUESTIONS.filter((q, qi) => {
    const selIdx = answers[qi]
    if (selIdx === undefined) return false
    const correctIdx = orders[qi].findIndex((oi) => q.options[oi].key === q.answer)
    return selIdx === correctIdx
  }).length

  // quiz_completed：4 题全答完时上报一次
  useEffect(() => {
    if (allDone && !completedRef.current) {
      completedRef.current = true
      track(
        'quiz_completed',
        { score: correctCount, total_questions: QUESTIONS.length },
        sessionId,
      )
    }
  }, [allDone, correctCount, sessionId])

  function handleAnswer(qi: number, selIdx: number) {
    if (answers[qi] !== undefined) return
    const q = QUESTIONS[qi]
    const optionOrder = orders[qi].map((oi) => q.options[oi].key)
    const correctIdx = orders[qi].findIndex((oi) => q.options[oi].key === q.answer)
    track(
      'quiz_question_answered',
      {
        question_id: q.qid,
        quiz_version: QUIZ_VERSION,
        option_order: optionOrder,
        selected_answer: selIdx,
        correct_answer: correctIdx,
        is_correct: selIdx === correctIdx,
      },
      sessionId,
    )
    setAnswers((p) => ({ ...p, [qi]: selIdx }))
  }

  return (
    <div
      ref={rootRef}
      className="mt-6 rounded-2xl border border-[#d7cfc3] bg-[#fcfaf1] p-5 sm:p-6 animate-ai-rise"
    >
      <p className="text-base font-semibold text-foreground">考考你，看懂了吗？</p>
      <p className="mt-1 text-xs text-muted-foreground">只有 4 题，选完自动对答案</p>

      <div className="mt-4 space-y-4">
        {QUESTIONS.map((item, qi) => {
          const chosen = answers[qi]
          const isAnswered = chosen !== undefined
          const correctIdx = orders[qi].findIndex((oi) => item.options[oi].key === item.answer)
          const isCorrect = chosen === correctIdx
          return (
            <div key={item.qid} className="rounded-xl border border-[#e8e4d8] bg-[#fcfaf1] p-4">
              <p className="text-sm font-medium text-foreground">
                {qi + 1}. {item.q}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {orders[qi].map((oi, i) => {
                  const opt = item.options[oi]
                  const isThis = chosen === i
                  let cls = 'border-[#e8e4d8] text-foreground hover:border-[#050505]'
                  if (isThis && isCorrect) cls = 'border-pop-blue bg-pop-blue/10'
                  else if (isThis && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-600'
                  else if (isAnswered && i === correctIdx) cls = 'border-pop-blue bg-pop-blue/10'
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => handleAnswer(qi, i)}
                      className={cn('rounded-full border-2 px-3 py-1.5 text-sm transition', cls)}
                    >
                      {opt.text}
                    </button>
                  )
                })}
              </div>
              {isAnswered && (
                <p
                  className={cn(
                    'mt-2 flex items-center gap-1 text-xs',
                    isCorrect ? 'text-pop-blue' : 'text-red-500',
                  )}
                >
                  {isCorrect ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                  {item.explain}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {allDone && (
        <div className="mt-4 rounded-xl bg-pop-yellow/20 p-4 text-center animate-ai-rise">
          <p className="text-sm font-semibold text-foreground">
            你答对了 {correctCount} / {QUESTIONS.length} 题
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {correctCount === QUESTIONS.length
              ? '你已经看懂 AI 是怎么工作的了！'
              : '可以再回头看看过程，或再问一个问题试试。'}
          </p>
        </div>
      )}
    </div>
  )
}
