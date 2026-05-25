export type CardColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'

export const CARD_COLORS: Record<CardColor, { stroke: string; fillLight: string; fillDark: string; textLight: string; textDark: string }> = {
  white:  { stroke: '#D4D4D4', fillLight: '#FFFFFF', fillDark: '#1E1E1E', textLight: '#18181B', textDark: '#F4F4F5' },
  red:    { stroke: '#EF4444', fillLight: '#FDE8E8', fillDark: '#1A0A0A', textLight: '#7F1D1D', textDark: '#FCA5A5' },
  orange: { stroke: '#F97316', fillLight: '#FEF0E0', fillDark: '#1A0F05', textLight: '#7C2D12', textDark: '#FDBA74' },
  yellow: { stroke: '#EAB308', fillLight: '#FDF8E1', fillDark: '#1A1705', textLight: '#713F12', textDark: '#FDE047' },
  green:  { stroke: '#22C55E', fillLight: '#E4F9EC', fillDark: '#051A0D', textLight: '#14532D', textDark: '#86EFAC' },
  cyan:   { stroke: '#06B6D4', fillLight: '#E0F5FA', fillDark: '#051519', textLight: '#164E63', textDark: '#67E8F9' },
  blue:   { stroke: '#3B82F6', fillLight: '#E8F0FE', fillDark: '#0A0F1A', textLight: '#1E3A5F', textDark: '#93C5FD' },
  purple: { stroke: '#A855F7', fillLight: '#F3E8FE', fillDark: '#10051A', textLight: '#581C87', textDark: '#D8B4FE' },
  pink:   { stroke: '#EC4899', fillLight: '#FDE8F2', fillDark: '#1A050F', textLight: '#831843', textDark: '#F9A8D4' },
  gray:   { stroke: '#9CA3AF', fillLight: '#F3F4F6', fillDark: '#141416', textLight: '#374151', textDark: '#D1D5DB' },
}

export const DEFAULT_CARD_WIDTH = 280
export const DEFAULT_CARD_HEIGHT = 200
export const CARD_HEADER_HEIGHT = 36
export const DEFAULT_CARD_CONTENT = '[{"type":"heading","props":{"level":2},"content":[]}]'

export const COLLAPSED_CARD_HEIGHT = 80
export const PROXIMITY_THRESHOLD = 60

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  width?: number
  height?: number
  collapsed?: boolean
}
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
  createdAt?: number
}