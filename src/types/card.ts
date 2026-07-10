export type CardColor = 'white' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'

export interface CardColorDef {
  stroke: string
  fillLight: string
  fillDark: string
  textLight: string
  textDark: string
  mutedLight: string
  mutedDark: string
}

export const CARD_COLORS: Record<CardColor, CardColorDef> = {
  white:  { stroke: '#D4D4D4', fillLight: '#FFFFFF', fillDark: '#333333', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#9CA3AF', mutedDark: '#6B7280' },
  red:    { stroke: '#EF4444', fillLight: '#FDE8E8', fillDark: '#3D2424', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  orange: { stroke: '#F97316', fillLight: '#FEF0E0', fillDark: '#3D3024', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  yellow: { stroke: '#EAB308', fillLight: '#FDF8E1', fillDark: '#3D3824', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  green:  { stroke: '#22C55E', fillLight: '#E4F9EC', fillDark: '#243D2C', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  cyan:   { stroke: '#06B6D4', fillLight: '#E0F5FA', fillDark: '#24353D', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  blue:   { stroke: '#3B82F6', fillLight: '#E8F0FE', fillDark: '#242A3D', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  purple: { stroke: '#A855F7', fillLight: '#F3E8FE', fillDark: '#30243D', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  pink:   { stroke: '#EC4899', fillLight: '#FDE8F2', fillDark: '#3D2430', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
  gray:   { stroke: '#9CA3AF', fillLight: '#F3F4F6', fillDark: '#2B2B2D', textLight: '#18181B', textDark: '#E4E4E7', mutedLight: '#18181B99', mutedDark: '#E4E4E799' },
}

export const DEFAULT_CARD_WIDTH = 280
export const DEFAULT_CARD_HEIGHT = 200
export const CARD_HEADER_HEIGHT = 36
export const DEFAULT_CARD_CONTENT = '[{"type":"heading","props":{"level":2},"content":[]}]'

export const COLLAPSED_CARD_HEIGHT = 80
export const PROXIMITY_THRESHOLD = 60

// ─── 文本注释节点 (Text Annotation Node) ───
// 画布级文字标注，不进入卡片库，内容内联存储在节点 data 中。
export type AnnotationFontSize = 'sm' | 'md' | 'lg' | 'xl'
export type AnnotationAlign = 'left' | 'center' | 'right'

export const ANNOTATION_FONT_SIZES: Record<AnnotationFontSize, number> = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
}

export const DEFAULT_ANNOTATION_WIDTH = 200
export const DEFAULT_ANNOTATION_HEIGHT = 28
// 单段落 BlockNote 文档（空段落）
export const DEFAULT_ANNOTATION_CONTENT = '[{"type":"paragraph","content":[]}]'

import type { FrameLayout } from '../components/canvas/utils/frameLayouts'

export interface LayoutSnapshot {
  localX: number
  localY: number
  width?: number
  height?: number
}

export interface MediaNodeData extends Record<string, unknown> {
  url: string
  type: 'image' | 'video' | 'embed'
  name?: string
}

export interface TextAnnotationNodeData extends Record<string, unknown> {
  /** 单段落 BlockNote 文档 JSON 字符串 */
  content: string
  fontSize: AnnotationFontSize
  align: AnnotationAlign
  color: CardColor
  width?: number
  height?: number
}

export interface CardNodeData extends Record<string, unknown> {
  cardId: string
  color: CardColor
  width?: number
  height?: number
  collapsed?: boolean
  frameId?: string
  frameLayout?: FrameLayout
  localX?: number
  localY?: number
  layoutSnapshots?: Partial<Record<FrameLayout, LayoutSnapshot>>
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