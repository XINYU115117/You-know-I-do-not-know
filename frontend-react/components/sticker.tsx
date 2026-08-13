import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type StickerShape =
  | 'blob'
  | 'petal'
  | 'squircle'
  | 'arch'
  | 'pill'
  | 'hex'
  | 'diamond'
  | 'arrow'
  | 'burst'
  | 'seal'
  | 'cloud'

export type StickerColor =
  | 'pop-yellow'
  | 'pop-blue'
  | 'pop-purple'
  | 'pop-orange'
  | 'pop-pink'
  | 'pop-lime'
  | 'paper'
  | 'ink'

const SHAPE_CLASS: Record<StickerShape, string> = {
  blob: 'shape-blob',
  petal: 'shape-petal',
  squircle: 'shape-squircle',
  arch: 'shape-arch',
  pill: 'shape-pill',
  hex: 'shape-hex',
  diamond: 'shape-diamond',
  arrow: 'shape-arrow',
  burst: 'shape-burst',
  seal: 'shape-seal',
  cloud: 'shape-cloud',
}

const FILL_CLASS: Record<StickerColor, string> = {
  'pop-yellow': 'bg-pop-yellow',
  'pop-blue': 'bg-pop-blue',
  'pop-purple': 'bg-pop-purple',
  'pop-orange': 'bg-pop-orange',
  'pop-pink': 'bg-pop-pink',
  'pop-lime': 'bg-pop-lime',
  paper: 'bg-paper',
  ink: 'bg-ink',
}

/**
 * A retro die-cut sticker: white edge + ink outline + flat color fill,
 * with freeform content floating on top. The three layers share the same
 * shape so any shape reads as a proper sticker.
 */
export function Sticker({
  shape = 'blob',
  color = 'pop-pink',
  rotate = 0,
  className,
  contentClassName,
  style,
  children,
}: {
  shape?: StickerShape
  color?: StickerColor
  rotate?: number
  className?: string
  contentClassName?: string
  style?: CSSProperties
  children?: ReactNode
}) {
  const shapeClass = SHAPE_CLASS[shape]
  return (
    <span
      className={cn('sticker', className)}
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, ...style }}
    >
      <span aria-hidden className={cn('sticker__edge', shapeClass)} />
      <span aria-hidden className={cn('sticker__ink', shapeClass)} />
      <span aria-hidden className={cn('sticker__fill', shapeClass, FILL_CLASS[color])} />
      <span className={cn('sticker__content', contentClassName)}>{children}</span>
    </span>
  )
}
