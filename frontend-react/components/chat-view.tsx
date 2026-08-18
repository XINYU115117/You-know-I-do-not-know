'use client'

import { useState } from 'react'
import { ArrowRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function ChatView({
  history,
  onSend,
  onHome,
}: {
  history: ChatMessage[]
  onSend: (q: string) => void
  onHome: () => void
}) {
  const [input, setInput] = useState('')

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      e.nativeEvent.isComposing !== true &&
      (e.nativeEvent as unknown as { keyCode?: number }).keyCode !== 229
    ) {
      e.preventDefault()
      const q = input.trim()
      if (!q) return
      setInput('')
      onSend(q)
    }
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-4xl flex-col px-4 pt-6 pb-5 sm:pt-10 sm:pb-5">
      <header className="flex items-center justify-between">
        <p className="text-base font-semibold text-foreground">对话记录</p>
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="size-3.5" />
          回到首页
        </button>
      </header>

      <div className="chat-scroll mt-6 flex-1 space-y-4 overflow-y-auto pr-1">
        {history.map((m, i) => (
          <div
            key={i}
            className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'user'
                  ? 'bg-ink text-paper'
                  : 'border border-[#e8e4d8] bg-[#fcfaf1] text-foreground',
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {history.length === 0 && (
          <p className="mt-10 text-center text-sm text-muted-foreground">
            还没有对话，从首页或这里开始提问吧
          </p>
        )}
      </div>

      <form
        className="home-input-wrap mx-auto w-full! max-w-[56rem]!"
        style={{
          minHeight: '4.25rem', // 固定高度：原 5.5rem(88px) 缩 20px → 68px，确保生效
          height: '4.25rem',
          paddingRight: '0', // 按钮完全贴框右边缘，无空隙
        }}
        onSubmit={(e) => {
          e.preventDefault()
          const q = input.trim()
          if (!q) return
          setInput('')
          onSend(q)
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={100}
          placeholder="继续提问，看 AI 怎么生成答案…"
          className="home-input"
          style={{ fontSize: 'calc(clamp(1rem, 1.35vw, 1.45rem) - 8px)' }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="home-send self-center! shrink-0"
          style={{
            margin: '4px', // 四周空隙 4px
            paddingTop: 'calc(clamp(0.75rem, 1vw, 1rem) - 4px)', // 按钮上下缩小 4px
            paddingBottom: 'calc(clamp(0.75rem, 1vw, 1rem) - 4px)',
            paddingLeft: 'calc(clamp(1.1rem, 1.5vw, 1.6rem) - 4px)', // 按钮左右缩小 4px
            paddingRight: 'calc(clamp(1.1rem, 1.5vw, 1.6rem) - 4px)',
          }}
        >
          发送 <ArrowRight className="size-5" strokeWidth={2.4} />
        </button>
      </form>
    </div>
  )
}
