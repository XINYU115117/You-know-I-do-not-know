import { cn } from '@/lib/utils'

export type Phase = 'input' | 'organizing' | 'fragments' | 'predicting' | 'review'

const STEPS: { key: Phase; label: string }[] = [
  { key: 'input', label: '提问' },
  { key: 'organizing', label: '整理' },
  { key: 'fragments', label: '碎片' },
  { key: 'predicting', label: '预测' },
  { key: 'review', label: '回顾' },
]

export function StageProgress({ phase }: { phase: Phase }) {
  const activeIndex = STEPS.findIndex((s) => s.key === phase)

  return (
    <ol className="flex items-center justify-center gap-1.5 sm:gap-2" aria-label="体验进度">
      {STEPS.map((s, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={s.key} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full border-2 text-xs font-semibold transition-colors',
                  active
                    ? 'border-ink bg-pop-pink text-ink'
                    : done
                      ? 'border-[#bcb7ad] bg-[#bcb7ad] text-ink'
                      : 'border-[#bcb7ad] bg-transparent text-[#746b68]',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm sm:inline',
                  active ? 'font-medium text-ink' : 'text-[#746b68]',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  'h-px w-4 sm:w-8 transition-colors',
                  done ? 'bg-[#bcb7ad]' : 'bg-[#d5d0c7]',
                )}
                aria-hidden
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
