'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const QUESTIONS: { q: string; options: [string, string]; answer: 0 | 1; explain: string }[] = [
  {
    q: '模型是「选概率最高的词」，还是「按概率抽签」？',
    options: ['选概率最高的词', '按概率抽签'],
    answer: 1,
    explain: '模型按概率抽签，所以偶尔会选中概率很低的选项。',
  },
  {
    q: '同一个问题问两次，答案一定一样吗？',
    options: ['一定一样', '不一定，可能不同'],
    answer: 1,
    explain: '每一步都在抽签，所以同一个问题可能得到不同的答案。',
  },
  {
    q: '模型是「先想好完整答案」，还是「一个字一个字拼出来」？',
    options: ['先想好完整答案', '一个字一个字拼出来'],
    answer: 1,
    explain: '答案不是一次想好的，而是一块一块预测、拼接出来的。',
  },
  {
    q: '模型答错了，是因为它「笨」，还是「它本来就可能答错」？',
    options: ['它笨', '它本来就可能答错'],
    answer: 1,
    explain: '模型只是在预测最可能的表达，本来就可能答错。',
  },
]

export function QuizCard() {
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const answeredCount = Object.keys(answers).length
  const correctCount = QUESTIONS.filter((q, i) => answers[i] === q.answer).length
  const allDone = answeredCount === QUESTIONS.length

  return (
    <div className="mt-6 rounded-2xl border border-[#d7cfc3] bg-[#fcfaf1] p-5 sm:p-6 animate-ai-rise">
      <p className="text-base font-semibold text-foreground">考考你，看懂了吗？</p>
      <p className="mt-1 text-xs text-muted-foreground">只有 4 题，选完自动对答案</p>

      <div className="mt-4 space-y-4">
        {QUESTIONS.map((item, qi) => {
          const chosen = answers[qi]
          const isAnswered = chosen !== undefined
          const isCorrect = chosen === item.answer
          return (
            <div key={qi} className="rounded-xl border border-[#e8e4d8] bg-[#fcfaf1] p-4">
              <p className="text-sm font-medium text-foreground">
                {qi + 1}. {item.q}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.options.map((opt, oi) => {
                  const isThis = chosen === oi
                  let cls = 'border-[#e8e4d8] text-foreground hover:border-[#050505]'
                  if (isThis && isCorrect) cls = 'border-pop-blue bg-pop-blue/10'
                  else if (isThis && !isCorrect) cls = 'border-red-400 bg-red-50 text-red-600'
                  else if (isAnswered && oi === item.answer) cls = 'border-pop-blue bg-pop-blue/10'
                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={isAnswered}
                      onClick={() => setAnswers((p) => ({ ...p, [qi]: oi }))}
                      className={cn('rounded-full border-2 px-3 py-1.5 text-sm transition', cls)}
                    >
                      {opt}
                    </button>
                  )
                })}
              </div>
              {isAnswered && (
                <p className={cn('mt-2 flex items-center gap-1 text-xs', isCorrect ? 'text-pop-blue' : 'text-red-500')}>
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
