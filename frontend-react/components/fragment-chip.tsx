'use client'

import { useState, type CSSProperties } from 'react'
import { displayToken, type Fragment } from '@/lib/api'
const STYLES = [
  { shape: 'petal', color: '#d99578', rotate: -2 },
  { shape: 'blob', color: '#c97886', rotate: 2 },
  { shape: 'round', color: '#83ab86', rotate: -1 },
  { shape: 'soft', color: '#628eae', rotate: 2 },
  { shape: 'round', color: '#d99578', rotate: -2 },
  { shape: 'soft', color: '#c97886', rotate: 1 },
] as const

export function FragmentChip({ fragment, index }: { fragment: Fragment; index: number }) {
  const [revealed, setRevealed] = useState(false)
  const s = STYLES[index % STYLES.length]

  return (
    <button
      type="button"
      onClick={() => setRevealed((v) => !v)}
      style={{ animationDelay: `${index * 90}ms`, '--chip-color': s.color, '--chip-rotate': `${s.rotate}deg` } as CSSProperties}
      className={`fragment-chip fragment-chip-${s.shape} animate-ai-pop ${revealed ? 'is-revealed' : ''}`}
      aria-pressed={revealed}
      aria-label={
        revealed
          ? `信息碎片 ${fragment.text}，AI 看到的编号 ${fragment.tokenId}`
          : `信息碎片 ${fragment.text}，点击查看 AI 看到的内容`
      }
    >
      {!revealed ? (
        <>
          <span className="fragment-chip-text">{displayToken(fragment.text)}</span>
          <span className="fragment-chip-caption">人类看到</span>
        </>
      ) : (
        <>
          <span className="fragment-chip-token">#{fragment.tokenId}</span>
          <span className="fragment-chip-text">{displayToken(fragment.text)}</span>
          <span className="fragment-chip-caption">AI 看到</span>
        </>
      )}
    </button>
  )
}
