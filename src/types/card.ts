export type CardColor = 'white' | 'yellow' | 'blue' | 'green' | 'pink' | 'purple'
export type CardVariant = 'solid' | 'glass' | 'outline'

export const CARD_COLORS: Record<CardColor, { bg: string; border: string; header: string; accent: string }> = {
  white:  { bg: '#ffffff', border: '#e2e8f0', header: '#f8fafc', accent: '#cbd5e1' },
  yellow: { bg: '#fefce8', border: '#fde047', header: '#fef9c3', accent: '#eab308' },
  blue:   { bg: '#eff6ff', border: '#93c5fd', header: '#dbeafe', accent: '#3b82f6' },
  green:  { bg: '#f0fdf4', border: '#86efac', header: '#dcfce7', accent: '#22c55e' },
  pink:   { bg: '#fdf2f8', border: '#f0abfc', header: '#fae8ff', accent: '#ec4899' },
  purple: { bg: '#f5f3ff', border: '#c4b5fd', header: '#ede9fe', accent: '#8b5cf6' },
}

export const DEFAULT_CARD_WIDTH = 280
export const DEFAULT_CARD_HEIGHT = 200
export const CARD_HEADER_HEIGHT = 36
export const DEFAULT_CARD_CONTENT = '[{"type":"heading","props":{"level":2},"content":[]}]'

export const COLLAPSED_CARD_HEIGHT = 80
export const FIXED_CARD_HEIGHT = 280
export const MIN_AUTO_CARD_HEIGHT = 120
export const MAX_AUTO_CARD_HEIGHT = 1800

export interface CardShapeProps {
  w: number
  h: number
  cardId: string
  content?: string
  title?: string
  color?: CardColor
  variant?: CardVariant
  createdAt?: number
}
