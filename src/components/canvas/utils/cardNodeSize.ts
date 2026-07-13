import type { Node } from '@xyflow/react'
import {
  COLLAPSED_CARD_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_CARD_WIDTH,
  type CardNodeData,
} from '../../../types/card'

export interface CardNodeSize {
  w: number
  h: number
}

export function getCardNodeSize(node: Node): CardNodeSize {
  const data = node.data as CardNodeData
  const w = data.width ?? DEFAULT_CARD_WIDTH
  const h = data.collapsed
    ? COLLAPSED_CARD_HEIGHT
    : (data.height ?? DEFAULT_CARD_HEIGHT)
  return { w, h }
}
